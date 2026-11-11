
const encoder = new TextEncoder();

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

function err(message, status = 400) {
  return response({ error: message }, status);
}

function hex(data) {
  return [...new Uint8Array(data)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function unhex(value) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2) {
    throw new Error("Hash inválido");
  }
  return Uint8Array.from(
    value.match(/../g).map(b => parseInt(b, 16))
  );
}

async function sha(value) {
  return hex(
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(value)
    )
  );
}

// PBKDF2 compatível com Cloudflare Workers.
const PASSWORD_ITERATIONS = 100000;

async function pbkdf(password, salt, iterations) {
  if (
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > PASSWORD_ITERATIONS
  ) {
    throw new Error("Parâmetro PBKDF2 não suportado");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derived = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: unhex(salt),
    iterations,
    hash: "SHA-256"
  }, key, 256);

  return hex(derived);
}

async function passwordHash(password) {
  const salt = hex(
    crypto.getRandomValues(new Uint8Array(16))
  );

  const result = await pbkdf(
    password,
    salt,
    PASSWORD_ITERATIONS
  );

  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${result}`;
}

async function verifyPassword(password, encoded) {
  if (typeof encoded !== "string") return false;

  const parts = encoded.split("$");
  if (parts.length !== 4) return false;

  const [scheme, rounds, salt, expected] = parts;

  if (scheme !== "pbkdf2") return false;

  const iterations = Number(rounds);

  if (
    !Number.isInteger(iterations) ||
    iterations !== PASSWORD_ITERATIONS
  ) {
    throw new Error("HASH_ITERATIONS_UNSUPPORTED");
  }

  const actual = unhex(
    await pbkdf(password, salt, iterations)
  );

  const reference = unhex(expected);

  if (actual.length !== reference.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < actual.length; i++) {
    difference |= actual[i] ^ reference[i];
  }

  return difference === 0;
}

function cookie(name, request) {
  return request.headers.get("cookie")
    ?.split(";")
    .map(s => s.trim())
    .find(s => s.startsWith(name + "="))
    ?.slice(name.length + 1) || "";
}

function newId() {
  return crypto.randomUUID();
}

function cleanString(value, max = 180) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function secureCookie(token, maxAge = 43200) {
  return (
    `agv_session=${token}; Path=/; HttpOnly; ` +
    `Secure; SameSite=Strict; Max-Age=${maxAge}`
  );
}

async function body(request) {
  const value = await request.json();

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("JSON inválido");
  }

  return value;
}

async function auth(request, db) {
  const token = cookie("agv_session", request);

  if (!token) return null;

  const tokenHash = await sha(token);

  const user = await db.prepare(`
    SELECT
      s.id AS session_id,
      s.farm_id,
      u.id AS user_id,
      u.username,
      u.display_name,
      u.role,
      u.organization_id,
      f.name AS farm_name
    FROM auth_sessions s
    JOIN app_users u ON u.id = s.user_id
    JOIN farms f ON f.id = s.farm_id
    WHERE s.session_token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > datetime('now')
      AND u.active = 1
      AND f.active = 1
      AND f.organization_id = u.organization_id
      AND s.organization_id = u.organization_id
      AND EXISTS (
        SELECT 1
        FROM user_farm_access a
        WHERE a.user_id = u.id
          AND a.organization_id = u.organization_id
          AND a.farm_id = f.id
          AND a.active = 1
      )
  `).bind(tokenHash).first();

  return user || null;
}

function userView(user) {
  return {
    id: user.user_id,
    username: user.username,
    name: user.display_name,
    role: user.role,
    farmId: user.farm_id,
    farmName: user.farm_name
  };
}

async function can(db, user, module, action) {
  if (["OWNER", "ADMIN"].includes(user.role)) {
    return true;
  }

  const result = await db.prepare(`
    SELECT up.allowed
    FROM user_permissions up
    JOIN access_permissions p
      ON p.id = up.permission_id
    WHERE up.user_id = ?
      AND up.organization_id = ?
      AND p.permission_code = ?
  `).bind(
    user.user_id,
    user.organization_id,
    `${module}:${action}`
  ).first();

  return result?.allowed === 1;
}

// LOGIN
async function login(request, db) {
  const data = await body(request);

  const username = cleanString(
    data.username, 100
  ).toLowerCase();

  const password = String(data.password || "");

  if (!username || !password) {
    return err("Informe usuário e senha.");
  }

  const attempts = await db.prepare(`
    SELECT COUNT(*) AS n
    FROM auth_login_attempts
    WHERE username = ?
      AND success = 0
      AND attempted_at > datetime('now','-15 minutes')
  `).bind(username).first();

  if (Number(attempts?.n || 0) >= 5) {
    return err(
      "Muitas tentativas. Aguarde 15 minutos.",
      429
    );
  }

  const user = await db.prepare(`
    SELECT
      id,
      username,
      password_hash,
      active,
      organization_id
    FROM app_users
    WHERE username = ?
  `).bind(username).first();

  let valid = false;

  if (user && user.active === 1) {
    try {
      valid = await verifyPassword(
        password,
        user.password_hash || ""
      );
    } catch (error) {
      if (
        error.message === "HASH_ITERATIONS_UNSUPPORTED"
      ) {
        return err(
          "Senha precisa de atualização no servidor.",
          503
        );
      }

      return err(
        "Falha na verificação da senha.",
        500
      );
    }
  }

  if (!user || !user.active || !valid) {
    await db.prepare(`
      INSERT INTO auth_login_attempts (
        id, username, success,
        failure_reason, user_id
      )
      VALUES (?, ?, 0, 'INVALID_CREDENTIALS', ?)
    `).bind(
      newId(),
      username,
      user?.id || null
    ).run();

    return err("Usuário ou senha inválidos.", 401);
  }

  const farm = await db.prepare(`
    SELECT f.id
    FROM farms f
    JOIN user_farm_access a
      ON a.farm_id = f.id
      AND a.user_id = ?
      AND a.organization_id = ?
      AND a.active = 1
    WHERE f.organization_id = ?
      AND f.active = 1
    ORDER BY f.id
    LIMIT 1
  `).bind(
    user.id,
    user.organization_id,
    user.organization_id
  ).first();

  if (!farm) {
    return err("Usuário sem granja disponível.", 403);
  }

  const token = hex(
    crypto.getRandomValues(new Uint8Array(32))
  );

  await db.prepare(`
    INSERT INTO auth_sessions (
      id, user_id, organization_id,
      farm_id, session_token_hash, expires_at
    )
    VALUES (
      ?, ?, ?, ?, ?, datetime('now','+12 hours')
    )
  `).bind(
    newId(),
    user.id,
    user.organization_id,
    farm.id,
    await sha(token)
  ).run();

  const result = response({ ok: true });

  result.headers.set(
    "set-cookie",
    secureCookie(token)
  );

  return result;
}

// CADASTRO E CONSULTA DE USUÁRIOS
async function usersEndpoint(request, db, user) {
  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return err("Permissão insuficiente.", 403);
  }

  if (request.method === "GET") {
    const rows = await db.prepare(`
      SELECT
        id, username, display_name,
        role, active, created_at
      FROM app_users
      WHERE organization_id = ?
      ORDER BY display_name
    `).bind(user.organization_id).all();

    return response({ users: rows.results });
  }

  if (request.method === "POST") {
    const data = await body(request);

    const username = cleanString(
      data.username, 100
    ).toLowerCase();

    const name = cleanString(data.name, 120);

    const password = String(data.password || "");

    const role = cleanString(
      data.role, 20
    ).toUpperCase();

    const roles = [
      "OWNER", "ADMIN", "MANAGER",
      "SUPERVISOR", "OPERATOR", "AUDITOR"
    ];

    if (
      !/^[a-z0-9._-]{3,100}$/.test(username) ||
      !name ||
      password.length < 12 ||
      !roles.includes(role)
    ) {
      return err(
        "Dados inválidos. A senha deve ter pelo menos 12 caracteres."
      );
    }

    if (role === "OWNER" && user.role !== "OWNER") {
      return err(
        "Somente MASTER pode criar outro MASTER.",
        403
      );
    }

    const id = newId();

    try {
      const hashed = await passwordHash(password);

      await db.prepare(`
        INSERT INTO app_users (
          id, organization_id, display_name,
          email, username, password_hash,
          role, active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        id,
        user.organization_id,
        name,
        `${id}@users.agrovelyx.invalid`,
        username,
        hashed,
        role
      ).run();

      const accessLevel =
        ["OWNER", "ADMIN"].includes(role)
          ? "ADMIN"
          : role === "MANAGER"
            ? "MANAGER"
            : role === "SUPERVISOR"
              ? "SUPERVISOR"
              : "OPERATOR";

      await db.prepare(`
        INSERT INTO user_farm_access (
          id, organization_id, user_id,
          farm_id, access_level, active
        )
        VALUES (?, ?, ?, ?, ?, 1)
      `).bind(
        newId(),
        user.organization_id,
        id,
        user.farm_id,
        accessLevel
      ).run();

      return response({ ok: true, id }, 201);
    } catch {
      return err(
        "Não foi possível criar o usuário. Verifique o cadastro.",
        409
      );
    }
  }

  return err("Método inválido.", 405);
}

// PERMISSÕES
async function permissionsEndpoint(request, db, user) {
  if (!["OWNER", "ADMIN"].includes(user.role)) {
    return err("Permissão insuficiente.", 403);
  }

  const data = await body(request);

  const target = cleanString(data.userId, 80);
  const module = cleanString(data.module, 90);
  const action = cleanString(data.action, 20);
  const allowed = data.allowed === true;

  if (
    !target ||
    !module ||
    !["read", "write"].includes(action)
  ) {
    return err("Permissão inválida.");
  }

  const targetUser = await db.prepare(`
    SELECT id, role
    FROM app_users
    WHERE id = ?
      AND organization_id = ?
  `).bind(
    target,
    user.organization_id
  ).first();

  if (!targetUser) {
    return err("Usuário não encontrado.", 404);
  }

  if (
    ["OWNER", "ADMIN"].includes(targetUser.role)
  ) {
    return err(
      "Este perfil já possui acesso administrativo.",
      400
    );
  }

  const code = `${module}:${action}`;

  let permission = await db.prepare(`
    SELECT id
    FROM access_permissions
    WHERE permission_code = ?
  `).bind(code).first();

  if (!permission) {
    await db.prepare(`
      INSERT OR IGNORE INTO access_permissions (
        id, permission_code,
        module_name, action_name
      )
      VALUES (?, ?, ?, ?)
    `).bind(
      newId(), code, module, action
    ).run();

    permission = await db.prepare(`
      SELECT id
      FROM access_permissions
      WHERE permission_code = ?
    `).bind(code).first();
  }

  await db.prepare(`
    INSERT INTO user_permissions (
      id, organization_id, user_id,
      permission_id, allowed
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, permission_id)
    DO UPDATE SET allowed = excluded.allowed
  `).bind(
    newId(),
    user.organization_id,
    target,
    permission.id,
    allowed ? 1 : 0
  ).run();

  return response({ ok: true });
}

// REGISTROS SEPARADOS POR GRANJA
async function recordsEndpoint(request, db, user) {
  if (request.method === "GET") {
    const rows = await db.prepare(`
      SELECT
        id, record_type,
        payload_json, updated_at
      FROM erp_records
      WHERE farm_id = ?
        AND organization_id = ?
      ORDER BY updated_at DESC
      LIMIT 5000
    `).bind(
      user.farm_id,
      user.organization_id
    ).all();

    const items = [];

    for (const record of rows.results) {
      if (
        await can(
          db, user, record.record_type, "read"
        )
      ) {
        try {
          items.push({
            id: record.id,
            type: record.record_type,
            value: JSON.parse(record.payload_json)
          });
        } catch {
          // Ignora dados JSON inválidos.
        }
      }
    }

    return response({ records: items });
  }

  if (request.method === "POST") {
    const data = await body(request);
    const type = cleanString(data.type, 90);

    if (
      !type ||
      !await can(db, user, type, "write")
    ) {
      return err(
        "Não autorizado neste módulo.",
        403
      );
    }

    if (
      !data.value ||
      typeof data.value !== "object" ||
      Array.isArray(data.value)
    ) {
      return err("Registro inválido.");
    }

    const json = JSON.stringify(data.value);

    if (json.length > 120000) {
      return err("Registro muito grande.", 413);
    }

    const id = cleanString(data.id, 100) || newId();

    const existing = await db.prepare(`
      SELECT id
      FROM erp_records
      WHERE id = ?
        AND farm_id = ?
        AND organization_id = ?
    `).bind(
      id,
      user.farm_id,
      user.organization_id
    ).first();

    if (existing) {
      await db.prepare(`
        UPDATE erp_records
        SET payload_json = ?,
            updated_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND farm_id = ?
          AND organization_id = ?
      `).bind(
        json,
        user.user_id,
        id,
        user.farm_id,
        user.organization_id
      ).run();
    } else {
      const collision = await db.prepare(`
        SELECT id
        FROM erp_records
        WHERE id = ?
      `).bind(id).first();

      if (collision) {
        return err(
          "Identificador utilizado em outra granja.",
          409
        );
      }

      await db.prepare(`
        INSERT INTO erp_records (
          id, organization_id, farm_id,
          record_type, payload_json,
          created_by, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        user.organization_id,
        user.farm_id,
        type,
        json,
        user.user_id,
        user.user_id
      ).run();
    }

    await db.prepare(`
      INSERT INTO audit_logs (
        id, organization_id, farm_id,
        user_id, action_type, module_name,
        entity_type, entity_id, occurred_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId(),
      user.organization_id,
      user.farm_id,
      user.user_id,
      existing ? "UPDATE" : "CREATE",
      type,
      "erp_records",
      id,
      new Date().toISOString()
    ).run();

    return response({ ok: true, id });
  }

  return err("Método inválido.", 405);
}

// ROTAS DO WORKER
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (!env.DB) {
      return err("Banco DB não vinculado.", 503);
    }

    try {
      // Diagnóstico público sem informações sensíveis.
      if (
        url.pathname === "/api/status" &&
        request.method === "GET"
      ) {
        await env.DB.prepare(
          "SELECT 1 AS ok"
        ).first();

        return response({
          ok: true,
          api: "agrovelyx",
          database: "connected"
        });
      }

      if (
        url.pathname === "/api/login" &&
        request.method === "POST"
      ) {
        return await login(request, env.DB);
      }

      // Todas as rotas seguintes exigem sessão.
      const user = await auth(request, env.DB);

      if (!user) {
        return err(
          "Sessão ausente ou expirada.",
          401
        );
      }

      if (
        url.pathname === "/api/me" &&
        request.method === "GET"
      ) {
        return response({ user: userView(user) });
      }

      if (
        url.pathname === "/api/logout" &&
        request.method === "POST"
      ) {
        await env.DB.prepare(`
          UPDATE auth_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(user.session_id).run();

        const result = response({ ok: true });

        result.headers.set(
          "set-cookie",
          secureCookie("", 0)
        );

        return result;
      }

      if (
        url.pathname === "/api/change-password" &&
        request.method === "POST"
      ) {
        const data = await body(request);

        const oldPassword = String(
          data.oldPassword || ""
        );

        const newPassword = String(
          data.newPassword || ""
        );

        if (
          newPassword.length < 12 ||
          newPassword === oldPassword
        ) {
          return err(
            "Use uma nova senha de pelo menos 12 caracteres."
          );
        }

        const current = await env.DB.prepare(`
          SELECT password_hash
          FROM app_users
          WHERE id = ?
            AND organization_id = ?
        `).bind(
          user.user_id,
          user.organization_id
        ).first();

        if (
          !await verifyPassword(
            oldPassword,
            current.password_hash
          )
        ) {
          return err(
            "Senha atual inválida.",
            403
          );
        }

        await env.DB.prepare(`
          UPDATE app_users
          SET password_hash = ?
          WHERE id = ?
            AND organization_id = ?
        `).bind(
          await passwordHash(newPassword),
          user.user_id,
          user.organization_id
        ).run();

        await env.DB.prepare(`
          UPDATE auth_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
            AND id <> ?
        `).bind(
          user.user_id,
          user.session_id
        ).run();

        return response({ ok: true });
      }

      if (url.pathname === "/api/users") {
        return usersEndpoint(
          request,
          env.DB,
          user
        );
      }

      if (
        url.pathname === "/api/permissions" &&
        request.method === "POST"
      ) {
        return permissionsEndpoint(
          request,
          env.DB,
          user
        );
      }

      if (url.pathname === "/api/records") {
        return recordsEndpoint(
          request,
          env.DB,
          user
        );
      }

      return err("Endpoint não encontrado.", 404);
    } catch (error) {
      console.error(
        "Agrovelyx API error:",
        error.message
      );

      return err(
        "Falha ao processar requisição.",
        500
      );
    }
  }
};

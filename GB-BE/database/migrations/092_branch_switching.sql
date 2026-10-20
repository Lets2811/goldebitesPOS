-- 092: Working across branches.
--
-- branches.switch ("Administrar todas las sedes") lets a user pick the branch
-- their session works at, or all of them, and see the branch comparison.
-- Without it a user assigned to a branch only reaches that branch's data,
-- now enforced by the API and not only by the screens.
--
-- The branch picked is kept on the refresh token, so the session stays at it
-- when the access token is renewed.

INSERT INTO permissions (code, module, description) VALUES
  ('branches.switch', 'settings', 'Administrar todas las sedes: cambiar de sede y ver la comparativa entre sedes')
ON CONFLICT (code) DO NOTHING;

-- Existing businesses' roles (new ones get it with the system roles).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'branches.switch'
WHERE r.name IN ('SUPER_ADMIN', 'OWNER')
ON CONFLICT DO NOTHING;

-- branch_selected: the session's branch was picked (switch-branch), so a
-- refresh keeps it; selected_branch_id NULL with branch_selected means "all".
ALTER TABLE refresh_tokens
  ADD COLUMN branch_selected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN selected_branch_id UUID REFERENCES branches (id) ON DELETE SET NULL;

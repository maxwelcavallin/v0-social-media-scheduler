-- Adiciona coluna is_super_admin na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Atribui super admin ao usuário eng.cavallin@gmail.com
UPDATE users SET is_super_admin = TRUE WHERE email = 'eng.cavallin@gmail.com';

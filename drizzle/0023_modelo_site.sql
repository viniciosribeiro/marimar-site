-- O modelo do site (Clássico ou Novo), escolhido em Site → Modelo do site.
-- {"modelo": "classico"|"novo", "ceu_por_hora": bool, "alterado_em": iso, "alterado_por": email}
-- O próprio site aplica esta coluna na primeira troca (src/lib/esquema-modelo-site.ts):
-- rodar duas vezes não muda nada.
ALTER TABLE "pousada" ADD COLUMN IF NOT EXISTS "modelo_site" jsonb;

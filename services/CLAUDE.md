# services/

VPS'te konteyner olarak çalışan servisler; her biri `pnpm service:new <ad>` ile
`infra/templates/fastapi-service/`'ten üretilir (Python 3.14, uv, FastAPI). Bu klasördeki servisler pnpm
workspace'inin parçası değildir (Node paketi değil).

- Servise özel README: `services/<ad>/README.md`. Sunucu tarafı compose: `infra/apps/<ad>/compose.yml`.
- Image: `ghcr.io/gokturkfulser/gokturkfulser-<ad>`; adres `<ad>.gokturkfulser.com`. Kurallar `infra/CLAUDE.md`'de.
- Şablonda değişiklik yapınca şablonun kendisini (`infra/templates/fastapi-service/`) düzelt; üretilmiş servisleri
  elle senkronla.

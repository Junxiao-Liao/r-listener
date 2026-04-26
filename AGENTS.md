# Styles

## Architecture

- Group files by feature
    - Backend each feature: `repository` `orm` `dto` `service` `route`
    - Frontend: `pages/` under which each page (feature) is self-contained
- Use existing ecosys, rather than build from scratch

## Coding

- Elegant FP style
    - Type system, domained types
    - HOFs
    - Split large into small typed modules/functions with one responsibility and explicit dependencies
- Type def should be centralized managed within feature use `*.type.ts` naming, similarly `*.service.ts`, etc.
- Test driven dev
    - Write tests first, as complete as possible

# Files

@FILE_TREE.md

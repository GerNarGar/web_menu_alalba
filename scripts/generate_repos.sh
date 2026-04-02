#!/usr/bin/env bash

set -e

branches=("opcion-a" "opcion-b" "opcion-c")
repos=("test-menu-a" "test-menu-b" "test-menu-c")

for i in "${!branches[@]}"; do
  branch=${branches[$i]}
  repo_name=${repos[$i]}
  folder="../$repo_name"

  echo "Procesando $branch → $repo_name"

  # Clonar repo actual
  git clone . "$folder"

  cd "$folder"

  # Cambiar a la rama
  git checkout "$branch"

  # Eliminar Git interno
  rm -rf .git

  # Inicializar nuevo repo
  git init
  git add .
  git commit -m "Initial commit from $branch"

  # Crear repo y subir (GitHub CLI)
  gh repo create "$repo_name" --public --source=. --remote=origin --push

  cd - > /dev/null
done

echo "Proceso completado"
# Azure Containers Lab

Despliegue de 6 contenedores públicos en Azure usando **Azure Container Registry (ACR)** y **Azure Container Instances (ACI)**. El proyecto contiene dos stacks completos:

- **Stack 1**: React (react-flask) → Flask API → MySQL
- **Stack 2**: React (react-node) → Node.js API → MongoDB

---

## 📂 Estructura del proyecto

```
Azure-Containers-Lab/
├── backend/
│   ├── flask-api/
│   │   ├── app.py
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── node-api/
│       ├── index.js
│       ├── Dockerfile
│       └── package.json
├── database/
│   ├── mysql/
│   │   ├── Dockerfile
│   │   └── init.sql
│   └── mongo/
│       ├── Dockerfile
│       └── init.js
├── frontend/
│   ├── react-flask/
│   │   ├── Dockerfile
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   └── src/
│   └── react-node/
│       ├── Dockerfile
│       ├── index.html
│       ├── vite.config.js
│       └── src/
└── README.md
```

---

## 🏗️ Arquitectura

```
                        Azure Resource Group (azure-containers-lab-rg)
                        ┌──────────────────────────────────────────────┐
                        │  ACR: azcontainerslabreg.azurecr.io          │
                        │                                              │
                        │  Stack 1 (Flask / MySQL)                     │
                        │  ┌────────────┐  ┌────────────┐  ┌────────┐ │
                        │  │ react-flask│→ │ flask-api  │→ │ mysql  │ │
                        │  │  :3000     │  │  :5000     │  │ :3306  │ │
                        │  └────────────┘  └────────────┘  └────────┘ │
                        │                                              │
                        │  Stack 2 (Node.js / MongoDB)                 │
                        │  ┌────────────┐  ┌────────────┐  ┌────────┐ │
                        │  │ react-node │→ │  node-api  │→ │ mongo  │ │
                        │  │  :3000     │  │  :3000     │  │ :27017 │ │
                        │  └────────────┘  └────────────┘  └────────┘ │
                        └──────────────────────────────────────────────┘
```

Todos los contenedores se despliegan como **ACI container groups** individuales con IP pública y DNS label único. La comunicación entre contenedores usa el FQDN público de cada ACI.

---

## ⚙️ Pre-requisitos

| Herramienta | Versión mínima |
|---|---|
| Azure CLI (`az`) | ≥ 2.50 |
| Docker CLI | ≥ 24.0 |

---

## 🚀 Despliegue paso a paso

### 1. Crear el Resource Group y ACR

```bash
az group create --name azure-containers-lab-rg --location eastus

az acr create \
  --resource-group azure-containers-lab-rg \
  --name azcontainerslabreg \
  --sku Basic \
  --admin-enabled true
```

### 2. Autenticar Docker en ACR

```bash
az acr login --name azcontainerslabreg
```

### 3. Build y push de las imágenes

> ⚠️ Los frontends React usan `VITE_API_URL` que se **embebe en el bundle en tiempo de build**, no en runtime. Debes conocer los DNS de las APIs antes de construir las imágenes frontend.

```bash
# Bases de datos
docker build -t azcontainerslabreg.azurecr.io/mysql:latest    ./database/mysql
docker build -t azcontainerslabreg.azurecr.io/mongo:latest    ./database/mongo

# APIs
docker build -t azcontainerslabreg.azurecr.io/flask-api:latest ./backend/flask-api
docker build -t azcontainerslabreg.azurecr.io/node-api:latest  ./backend/node-api

# Frontends — sustituir <PREFIX> por tu prefijo (ej: aclab)
docker build \
  --build-arg VITE_API_URL=http://<PREFIX>-flask.eastus.azurecontainer.io:5000 \
  -t azcontainerslabreg.azurecr.io/react-flask:latest \
  ./frontend/react-flask

docker build \
  --build-arg VITE_API_URL=http://<PREFIX>-node.eastus.azurecontainer.io:3000 \
  -t azcontainerslabreg.azurecr.io/react-node:latest \
  ./frontend/react-node

# Push de todas las imágenes
docker push azcontainerslabreg.azurecr.io/mysql:latest
docker push azcontainerslabreg.azurecr.io/mongo:latest
docker push azcontainerslabreg.azurecr.io/flask-api:latest
docker push azcontainerslabreg.azurecr.io/node-api:latest
docker push azcontainerslabreg.azurecr.io/react-flask:latest
docker push azcontainerslabreg.azurecr.io/react-node:latest
```

### 4. Desplegar los contenedores en ACI

Primero, exporta las variables que se reutilizan en todos los comandos:

```bash
ACR_USER=$(az acr credential show --name azcontainerslabreg --query username -o tsv)
ACR_PASS=$(az acr credential show --name azcontainerslabreg --query passwords[0].value -o tsv)
ACR_SERVER="azcontainerslabreg.azurecr.io"
RG="azure-containers-lab-rg"
PREFIX="aclab"
REGION="eastus"
```

**Orden obligatorio: bases de datos → APIs → frontends**

#### MySQL

```bash
az container create \
  --resource-group $RG \
  --name ${PREFIX}-mysql \
  --image ${ACR_SERVER}/mysql:latest \
  --registry-login-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --dns-name-label ${PREFIX}-mysql \
  --ports 3306 \
  --ip-address Public \
  --environment-variables \
      MYSQL_DATABASE=appdb \
      MYSQL_USER=appuser \
  --secure-environment-variables \
      MYSQL_ROOT_PASSWORD=RootP@ssw0rd! \
      MYSQL_PASSWORD=P@ssw0rd! \
  --cpu 1 --memory 1
```

#### MongoDB

```bash
az container create \
  --resource-group $RG \
  --name ${PREFIX}-mongo \
  --image ${ACR_SERVER}/mongo:latest \
  --registry-login-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --dns-name-label ${PREFIX}-mongo \
  --ports 27017 \
  --ip-address Public \
  --secure-environment-variables \
      MONGO_INITDB_ROOT_USERNAME=root \
      MONGO_INITDB_ROOT_PASSWORD=RootP@ssw0rd! \
  --cpu 1 --memory 1
```

#### Flask API

```bash
az container create \
  --resource-group $RG \
  --name ${PREFIX}-flask \
  --image ${ACR_SERVER}/flask-api:latest \
  --registry-login-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --dns-name-label ${PREFIX}-flask \
  --ports 5000 \
  --ip-address Public \
  --environment-variables \
      DB_HOST=${PREFIX}-mysql.${REGION}.azurecontainer.io \
      DB_USER=appuser \
      DB_NAME=appdb \
  --secure-environment-variables \
      DB_PASS=P@ssw0rd! \
  --cpu 1 --memory 1
```

#### Node.js API

```bash
az container create \
  --resource-group $RG \
  --name ${PREFIX}-node \
  --image ${ACR_SERVER}/node-api:latest \
  --registry-login-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --dns-name-label ${PREFIX}-node \
  --ports 3000 \
  --ip-address Public \
  --environment-variables \
      MONGO_HOST=${PREFIX}-mongo.${REGION}.azurecontainer.io \
      MONGO_PORT=27017 \
      MONGO_USER=appuser \
      MONGO_DB=appdb \
  --secure-environment-variables \
      MONGO_PASS=P@ssw0rd! \
  --cpu 1 --memory 1
```

#### React (Stack 1 — Flask)

```bash
az container create \
  --resource-group $RG \
  --name ${PREFIX}-react-flask \
  --image ${ACR_SERVER}/react-flask:latest \
  --registry-login-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --dns-name-label ${PREFIX}-react-flask \
  --ports 3000 \
  --ip-address Public \
  --cpu 1 --memory 1
```

#### React (Stack 2 — Node.js)

```bash
az container create \
  --resource-group $RG \
  --name ${PREFIX}-react-node \
  --image ${ACR_SERVER}/react-node:latest \
  --registry-login-server $ACR_SERVER \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --dns-name-label ${PREFIX}-react-node \
  --ports 3000 \
  --ip-address Public \
  --cpu 1 --memory 1
```

---

## 🌐 Puertos y DNS

| Servicio | DNS | Puerto |
|---|---|---|
| mysql | `<PREFIX>-mysql.<REGION>.azurecontainer.io` | 3306 |
| mongo | `<PREFIX>-mongo.<REGION>.azurecontainer.io` | 27017 |
| flask-api | `<PREFIX>-flask.<REGION>.azurecontainer.io` | 5000 |
| node-api | `<PREFIX>-node.<REGION>.azurecontainer.io` | 3000 |
| react-flask | `<PREFIX>-react-flask.<REGION>.azurecontainer.io` | 3000 |
| react-node | `<PREFIX>-react-node.<REGION>.azurecontainer.io` | 3000 |

---

## 🔑 Variables de entorno

### MySQL
| Variable | Descripción |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Contraseña del usuario root |
| `MYSQL_DATABASE` | Nombre de la base de datos (`appdb`) |
| `MYSQL_USER` | Usuario de la aplicación (`appuser`) |
| `MYSQL_PASSWORD` | Contraseña del usuario de la aplicación |

### MongoDB
| Variable | Descripción |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Usuario root de MongoDB |
| `MONGO_INITDB_ROOT_PASSWORD` | Contraseña root de MongoDB |

### Flask API
| Variable | Descripción |
|---|---|
| `DB_HOST` | FQDN del contenedor MySQL |
| `DB_USER` | Usuario de la app (`appuser`) |
| `DB_PASS` | Contraseña del usuario de la app |
| `DB_NAME` | Nombre de la base de datos (`appdb`) |

### Node.js API
| Variable | Descripción |
|---|---|
| `MONGO_HOST` | FQDN del contenedor MongoDB |
| `MONGO_PORT` | Puerto de MongoDB (`27017`) |
| `MONGO_USER` | Usuario de la app (`appuser`) |
| `MONGO_PASS` | Contraseña del usuario de la app |
| `MONGO_DB` | Nombre de la base de datos (`appdb`) |

### React (build-time)
| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL completa de la API (se embebe en el bundle al hacer build) |

---

## ✅ Verificación post-despliegue

```bash
# APIs
curl http://<PREFIX>-flask.eastus.azurecontainer.io:5000/items
curl http://<PREFIX>-node.eastus.azurecontainer.io:3000/items

# Frontends
curl -I http://<PREFIX>-react-flask.eastus.azurecontainer.io:3000
curl -I http://<PREFIX>-react-node.eastus.azurecontainer.io:3000
```

---

## 🔧 Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| `ImageNotFound` al crear ACI | Credenciales ACR incorrectas o imagen no pusheada | Verificar con `az acr repository list --name azcontainerslabreg` |
| API devuelve 500 en `/items` | `DB_HOST` / `MONGO_HOST` incorrecto o BD no iniciada | Confirmar FQDN con `az container show --name <svc> --query ipAddress.fqdn` |
| Frontend no conecta a la API | `VITE_API_URL` incorrecto en el build | Reconstruir la imagen con el `--build-arg` correcto y re-desplegar |
| `DnsNameLabelNotAvailable` | El DNS label ya está en uso en la región | Cambiar el valor de `PREFIX` |

---

## 🔒 Seguridad

- Usar `--secure-environment-variables` para contraseñas (evita que aparezcan en `az container show`).
- El admin account de ACR está habilitado por simplicidad del lab. En producción usar un service principal o managed identity.
- Los puertos de base de datos (3306, 27017) están expuestos públicamente — aceptable en lab, **no recomendado en producción**.
- Sin TLS configurado. En producción, usar Application Gateway o Azure Front Door para terminar HTTPS.

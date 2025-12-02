# Examples

Here you can see some prompts that you can ask to the `mcp-server`.  
Remember to change the values inside the curly braces `{}` with your specific information.

## Project Creation

```txt
Create a Mia-Platform Project named {projectName} in the {companyName} company using the {templateName} template
```

## Microservice Creation

```txt
In {projectName} project, create an endpoint /foo which exposes the service with name echo and docker image
davidebianchi/echo-service. If the service not exists, create it.
```

```txt
Create a microservice named {microserviceName} using the template {templateName} in the project {projectName}
```

## Runtime Environments and Workload Discovery

```txt
Which are the current configurations of the project {projectName}? Provide a table that lists all workloads, replicas, status and if it's source code, a container, or a resource.
List also all endpoints exposed and if they are protected or public and which microservice exposes that endpoint
```

```txt
Check all projects in the tenant {tenantName} and verify if there is code duplication and if items in the marketplace/software catalog are properly reused
```

```txt
Show me the resource utilization of all services in project {projectName} in the PRODUCTION environment. Identify any services that are over-provisioned or under-provisioned
```

```txt
Compare the configurations between DEV and PRODUCTION environments for project {projectName} and highlight any inconsistencies or differences that could cause deployment issues
```

## CRUD Service Management

```txt
Create a CRUD Service with the following collections in {projectName}:
  - customers
  - products
  - payments
  - shipping
Add the properties needed to describe all domains
```

```txt
Create a CRUD Service for an inventory management system with the following collections in {projectName}:
  - items (with only this additional fields for SKU, name, description, quantity, location, supplier)
  - suppliers (with only this additional fields for name, contact information, payment terms)
  - purchase_orders (with only this additional fields for order date, supplier, items, status, delivery date)
  - inventory_movements (with only this additional fields for item, quantity, direction, timestamp, reason)

Add appropriate indexes for optimizing common queries
```

## Config Maps Management

```txt
List all config maps in project {projectName} for the main branch
```

```txt
Show me the details of the config map named {configMapName} in project {projectName}
```

```txt
Create a new config map named app-settings in project {projectName} with the following files:
  - application.json containing {"port": 8080, "env": "production", "debug": false}
  - database.conf containing host=db.example.com port=5432
```

```txt
In project {projectName}, create a config map called nginx-config with a file nginx.conf containing the following configuration:
server {
  listen 80;
  server_name example.com;
  location / {
    proxy_pass http://backend:3000;
  }
}
```

```txt
Update the config map {configMapName} in project {projectName} by replacing all files with:
  - settings.yaml containing debug: true and log_level: info
  - env.conf containing ENV=staging and MAX_CONNECTIONS=100
```

```txt
Delete the config map named {configMapName} from project {projectName} if it's not being used by any service
```

```txt
In project {projectName}, check which config maps exist and create a new one called api-config with configuration files for the API gateway including rate limits and CORS settings
```

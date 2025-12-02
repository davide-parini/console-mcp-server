// Copyright Mia srl
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { CallToolResult } from '@modelcontextprotocol/sdk/types'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { Collections, ConfigMaps, Endpoints, ServiceAccounts, Services } from '@mia-platform/console-types'

import { APIClient } from '../../apis/client'
import { ResourcesToCreate } from '../../apis/types/configuration'
import { paramsDescriptions, toolNames, toolsDescriptions } from '../descriptions'

// Kubernetes DNS-1123 subdomain validation
const CONFIG_MAP_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
const CONFIG_MAP_NAME_MAX_LENGTH = 253

function validateConfigMapName (name: string): void {
  if (!name) {
    throw new Error('Config map name is required')
  }
  
  if (name.length > CONFIG_MAP_NAME_MAX_LENGTH) {
    throw new Error(`Config map name '${name}' exceeds maximum length of ${CONFIG_MAP_NAME_MAX_LENGTH} characters`)
  }
  
  if (!CONFIG_MAP_NAME_REGEX.test(name)) {
    throw new Error(
      `Config map name '${name}' is invalid: must match Kubernetes DNS-1123 format ` +
      `(lowercase alphanumeric characters or hyphens, must start and end with alphanumeric)`
    )
  }
}

async function listConfigMaps (
  client: APIClient,
  projectId: string,
  refId: string
): Promise<ConfigMaps> {
  const config = await client.getConfiguration(projectId, refId)
  return config.configMaps || {}
}

async function getConfigMap (
  client: APIClient,
  projectId: string,
  refId: string,
  configMapName: string
): Promise<ConfigMaps[string]> {
  validateConfigMapName(configMapName)
  
  const config = await client.getConfiguration(projectId, refId)
  const configMap = config.configMaps?.[configMapName]
  
  if (!configMap) {
    throw new Error(`Config map '${configMapName}' not found`)
  }
  
  return configMap
}

async function createConfigMap (
  client: APIClient,
  projectId: string,
  refId: string,
  configMapName: string,
  files: Array<{ name: string, content: string }>
): Promise<void> {
  validateConfigMapName(configMapName)
  
  if (!files || files.length === 0) {
    throw new Error('At least one file is required to create a config map')
  }
  
  const config = await client.getConfiguration(projectId, refId)
  
  if (config.configMaps?.[configMapName]) {
    throw new Error(`Config map '${configMapName}' already exists`)
  }
  
  const resourcesToCreate: ResourcesToCreate = {
    configMaps: {
      [configMapName]: {
        name: configMapName,
        files,
      },
    },
  }
  
  await client.saveConfiguration(projectId, refId, resourcesToCreate)
}

async function updateConfigMap (
  client: APIClient,
  projectId: string,
  refId: string,
  configMapName: string,
  files: Array<{ name: string, content: string }>
): Promise<void> {
  validateConfigMapName(configMapName)
  
  if (!files || files.length === 0) {
    throw new Error('At least one file is required to update a config map')
  }
  
  const config = await client.getConfiguration(projectId, refId)
  
  if (!config.configMaps?.[configMapName]) {
    throw new Error(`Config map '${configMapName}' does not exist`)
  }
  
  const resourcesToCreate: ResourcesToCreate = {
    configMaps: {
      [configMapName]: {
        name: configMapName,
        files,
      },
    },
  }
  
  await client.saveConfiguration(projectId, refId, resourcesToCreate)
}

async function deleteConfigMap (
  client: APIClient,
  projectId: string,
  refId: string,
  configMapName: string
): Promise<void> {
  validateConfigMapName(configMapName)
  
  const config = await client.getConfiguration(projectId, refId)
  
  if (!config.configMaps?.[configMapName]) {
    throw new Error(`Config map '${configMapName}' does not exist`)
  }
  
  // Check if any service references this config map
  const servicesUsingConfigMap: string[] = []
  if (config.services) {
    for (const [serviceName, service] of Object.entries(config.services)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serviceConfigMaps = (service as any).configMaps
      if (serviceConfigMaps && Array.isArray(serviceConfigMaps)) {
        const hasReference = serviceConfigMaps.some(
          (cm: { name: string }) => cm.name === configMapName
        )
        if (hasReference) {
          servicesUsingConfigMap.push(serviceName)
        }
      }
    }
  }
  
  if (servicesUsingConfigMap.length > 0) {
    throw new Error(
      `Cannot delete config map '${configMapName}': it is referenced by the following services: ${servicesUsingConfigMap.join(', ')}`
    )
  }
  
  // Remove the config map by saving configuration without it
  const updatedConfigMaps = { ...config.configMaps }
  delete updatedConfigMaps[configMapName]
  
  const resourcesToCreate: ResourcesToCreate = {
    configMaps: updatedConfigMaps,
  }
  
  await client.saveConfiguration(projectId, refId, resourcesToCreate)
}

export function addConfigurationCapabilities (server: McpServer, client: APIClient) {
  server.tool(
    toolNames.LIST_CONFIGURATION_REVISIONS,
    toolsDescriptions.LIST_CONFIGURATION_REVISIONS,
    {
      projectId: z.string().describe(paramsDescriptions.PROJECT_ID),
    },
    async ({ projectId }): Promise<CallToolResult> => {
      try {
        const revisions = await client.getConfigurationRevisions(projectId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(revisions),
            },
          ],
        }
      } catch (error) {
        const err = error as Error
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching revisions or versions: ${err.message}`,
            },
          ],
        }
      }
    },
  )

  server.tool(
    toolNames.GET_CONFIGURATION,
    toolsDescriptions.GET_CONFIGURATION,
    {
      projectId: z.string().describe(paramsDescriptions.PROJECT_ID),
      refId: z.string().describe(paramsDescriptions.REF_ID),
    },
    async ({ projectId, refId }): Promise<CallToolResult> => {
      try {
        const config = await client.getConfiguration(projectId, refId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(config),
            },
          ],
        }
      } catch (error) {
        const err = error as Error
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching configuration: ${err.message}`,
            },
          ],
        }
      }
    },
  )

  server.tool(
    toolNames.CONFIGURATION_TO_SAVE,
    toolsDescriptions.CONFIGURATION_TO_SAVE,
    {
      projectId: z.string().describe(paramsDescriptions.PROJECT_ID),
      refId: z.string().describe(paramsDescriptions.REF_ID),
      endpoints: z.record(z.string(), z.unknown()).optional().describe(paramsDescriptions.ENDPOINTS),
      collections: z.record(z.string(), z.unknown()).optional().describe(paramsDescriptions.COLLECTIONS),
      services: z.record(z.string(), z.unknown()).optional().describe(paramsDescriptions.SERVICES),
      configMaps: z.record(z.string(), z.unknown()).optional().describe(paramsDescriptions.CONFIG_MAPS),
      serviceAccounts: z.record(z.string(), z.unknown()).optional().describe(paramsDescriptions.SERVICE_ACCOUNTS),
    },
    async ({ projectId, endpoints, collections, refId, services, configMaps, serviceAccounts }): Promise<CallToolResult> => {
      try {
        const resourcesToCreate: ResourcesToCreate = {
          endpoints: endpoints as Endpoints,
          collections: collections as Collections,
          services: services as Services,
          configMaps: configMaps as ConfigMaps,
          serviceAccounts: serviceAccounts as ServiceAccounts,
        }
        await client.saveConfiguration(projectId, refId, resourcesToCreate)
        return {
          content: [
            {
              type: 'text',
              text: `Configuration saved successfully.`,
            },
          ],
        }
      } catch (error) {
        const err = error as Error
        return {
          content: [
            {
              type: 'text',
              text: `Error saving configuration: ${err.message}`,
            },
          ],
        }
      }
    },
  )

  server.tool(
    toolNames.MANAGE_CONFIG_MAPS,
    toolsDescriptions.MANAGE_CONFIG_MAPS,
    {
      projectId: z.string().describe(paramsDescriptions.PROJECT_ID),
      refId: z.string().describe(paramsDescriptions.REF_ID),
      operation: z.enum(['list', 'get', 'create', 'update', 'delete']).describe(paramsDescriptions.OPERATION),
      configMapName: z.string().optional().describe(paramsDescriptions.CONFIG_MAP_NAME),
      files: z.array(z.object({
        name: z.string(),
        content: z.string(),
      })).optional().describe(paramsDescriptions.CONFIG_MAP_FILES),
    },
    async ({ projectId, refId, operation, configMapName, files }): Promise<CallToolResult> => {
      try {
        // Validate required parameters based on operation
        if (operation !== 'list' && !configMapName) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: configMapName is required for '${operation}' operation`,
              },
            ],
          }
        }
        
        if ((operation === 'create' || operation === 'update') && !files) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: files are required for '${operation}' operation`,
              },
            ],
          }
        }
        
        // Execute operation
        switch (operation) {
          case 'list': {
            const configMaps = await listConfigMaps(client, projectId, refId)
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(configMaps),
                },
              ],
            }
          }
          
          case 'get': {
            const configMap = await getConfigMap(client, projectId, refId, configMapName!)
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(configMap),
                },
              ],
            }
          }
          
          case 'create': {
            await createConfigMap(client, projectId, refId, configMapName!, files!)
            return {
              content: [
                {
                  type: 'text',
                  text: `Config map '${configMapName}' created successfully with ${files!.length} file(s).`,
                },
              ],
            }
          }
          
          case 'update': {
            await updateConfigMap(client, projectId, refId, configMapName!, files!)
            return {
              content: [
                {
                  type: 'text',
                  text: `Config map '${configMapName}' updated successfully with ${files!.length} file(s).`,
                },
              ],
            }
          }
          
          case 'delete': {
            await deleteConfigMap(client, projectId, refId, configMapName!)
            return {
              content: [
                {
                  type: 'text',
                  text: `Config map '${configMapName}' deleted successfully.`,
                },
              ],
            }
          }
          
          default:
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: unknown operation '${operation}'`,
                },
              ],
            }
        }
      } catch (error) {
        const err = error as Error
        return {
          content: [
            {
              type: 'text',
              text: `Error ${operation} config map: ${err.message}`,
            },
          ],
        }
      }
    },
  )
}

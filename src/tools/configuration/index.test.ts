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

import { beforeEach, suite, test } from 'node:test'

import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

import { addConfigurationCapabilities } from '.'
import { APIClient } from '../../apis/client'
import { TestMCPServer } from '../../server/utils.test'
import {
  ResourcesToCreate,
  SaveConfigurationOptions,
  SaveResponse,
} from '../../apis/types/configuration'

interface TextContent {
  text: string
  type: string
}

const revisions = [
  { name: 'main' },
  { name: 'feature-branch' },
]

const tags = [
  { name: 'v1.0.0' },
  { name: 'v1.1.0' },
]

// Mock configuration object for tests
const mockConfiguration = {
  services: {
    'api-gateway': {
      name: 'api-gateway',
      type: 'custom',
      advanced: false,
      sourceComponentId: 'api-gateway',
      dockerImage: 'nexus.mia-platform.eu/core/api-gateway:9.3.0',
      replicas: 1,
    },
  },
  endpoints: {
    '/': {
      basePath: '/',
      type: 'custom',
      service: 'api-gateway',
      pathRewrite: '/',
      public: true,
      acl: 'true',
      description: 'API Gateway endpoint',
      listeners: { web: true },
      secreted: false,
      showInDocumentation: true,
    },
  },
  listeners: {
    web: {
      name: 'web',
      port: 8080,
      selectedByDefault: true,
    },
  },
  commitId: 'abc123',
}

// Mock save response for tests
const mockSaveResponse = {
  id: 'new-commit-id',
}

suite('list configuration revisions tool', () => {
  let client: Client

  beforeEach(async () => {
    client = await TestMCPServer((server) => {
      addConfigurationCapabilities(server, {
        async getConfigurationRevisions (projectId: string): Promise<Record<string, unknown>> {
          if (projectId === 'error-project') {
            throw new Error('error message')
          }

          return {
            revisions,
            versions: tags,
          }
        },
      } as APIClient)
    })
  })

  test('should return revisions and tags', async (t) => {
    const projectId = 'project123'

    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'list_configuration_revisions',
        arguments: {
          projectId,
        },
      },
    }, CallToolResultSchema)

    t.assert.deepEqual(result.content, [
      {
        text: JSON.stringify({
          revisions,
          versions: tags,
        }),
        type: 'text',
      },
    ])
  })

  test('should return error message if request returns error', async (t) => {
    const projectId = 'error-project'
    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'list_configuration_revisions',
        arguments: {
          projectId,
        },
      },
    }, CallToolResultSchema)

    t.assert.deepEqual(result.content, [
      {
        text: 'Error fetching revisions or versions: error message',
        type: 'text',
      },
    ])
  })
})

suite('get configuration tool', () => {
  let client: Client

  beforeEach(async () => {
    client = await TestMCPServer((server) => {
      addConfigurationCapabilities(server, {
        async getConfiguration (projectId: string, _refId: string): Promise<Record<string, unknown>> {
          if (projectId === 'error-project') {
            throw new Error('some error')
          }
          return mockConfiguration
        },
      } as APIClient)
    })
  })

  test('should retrieve and return configuration', async (t) => {
    const projectId = 'project123'
    const refId = 'main'

    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'configuration_get',
        arguments: {
          projectId,
          refId,
        },
      },
    }, CallToolResultSchema)

    t.assert.deepEqual(result.content, [
      {
        text: JSON.stringify(mockConfiguration),
        type: 'text',
      },
    ])
  })

  test('should return error message if API request fails', async (t) => {
    const projectId = 'error-project'
    const refId = 'main'

    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'configuration_get',
        arguments: {
          projectId,
          refId,
        },
      },
    }, CallToolResultSchema)

    t.assert.deepEqual(result.content, [
      {
        text: 'Error fetching configuration: some error',
        type: 'text',
      },
    ])
  })
})

suite('configuration save tool', () => {
  let client: Client

  beforeEach(async () => {
    client = await TestMCPServer((server) => {
      addConfigurationCapabilities(server, {
        async saveConfiguration (
          projectID: string,
          _refID: string,
          _resourcesToCreate: ResourcesToCreate,
          _options?: SaveConfigurationOptions,
        ): Promise<SaveResponse> {
          if (projectID === 'error-project') {
            throw new Error('some error')
          }

          return mockSaveResponse
        },
      } as APIClient)
    })
  })

  test('should save configuration successfully with multiple resource types', async (t) => {
    const projectId = 'project123'
    const refId = 'main'

    const endpointsToSave = {
      '/api': {
        basePath: '/api',
        type: 'custom',
        service: 'api-service',
        pathRewrite: '/',
        public: true,
        acl: 'true',
        description: 'API endpoint',
        listeners: { web: true },
        secreted: false,
        showInDocumentation: true,
      },
    }

    const servicesToSave = {
      'new-service': {
        name: 'new-service',
        type: 'custom',
        advanced: false,
        dockerImage: 'nexus.mia-platform.eu/core/new-service:1.0.0',
        replicas: 2,
      },
    }

    const configMapsToSave = {
      'app-config': {
        name: 'app-config',
        description: 'Application configuration',
        variables: {
          ENV: 'production',
          LOG_LEVEL: 'info',
        },
      },
    }

    const collectionsToSave = {
      users: {
        name: 'users',
        fields: [
          { name: 'firstName', type: 'string', required: true },
          { name: 'lastName', type: 'string', required: true },
          { name: 'email', type: 'string', required: true, unique: true },
        ],
        indexes: [
          { name: 'email_idx', unique: true, fields: [ { name: 'email' } ] },
        ],
      },
    }

    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'configuration_save',
        arguments: {
          projectId,
          refId,
          endpoints: endpointsToSave,
          services: servicesToSave,
          configMaps: configMapsToSave,
          collections: collectionsToSave,
        },
      },
    }, CallToolResultSchema)

    t.assert.deepEqual(result.content, [
      {
        text: 'Configuration saved successfully.',
        type: 'text',
      },
    ])
  })

  test('should return error message if POST request fails', async (t) => {
    const projectId = 'error-project'
    const refId = 'main'

    const endpointsToSave = {
      '/api': {
        basePath: '/api',
        type: 'custom',
        service: 'api-service',
        pathRewrite: '/',
        public: true,
        acl: 'true',
        description: 'API endpoint',
        listeners: { web: true },
        secreted: false,
        showInDocumentation: true,
      },
    }

    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'configuration_save',
        arguments: {
          projectId,
          refId,
          endpoints: endpointsToSave,
        },
      },
    }, CallToolResultSchema)

    t.assert.deepEqual(result.content, [
      {
        text: 'Error saving configuration: some error',
        type: 'text',
      },
    ])
  })
})

suite('manage config maps tool', () => {
  const projectId = 'project123'
  const refId = 'main'
  const mockConfigMaps = {
    'app-config': {
      name: 'app-config',
      files: [
        { name: 'application.json', content: '{"port": 8080}' },
        { name: 'settings.yaml', content: 'debug: true' },
      ],
    },
    'db-config': {
      name: 'db-config',
      files: [
        { name: 'database.conf', content: 'host=localhost' },
      ],
    },
  }

  const mockConfigWithReferences = {
    configMaps: mockConfigMaps,
    services: {
      'api-service': {
        name: 'api-service',
        configMaps: [
          { name: 'app-config', mountPath: '/config' },
        ],
      },
    },
    commitId: 'abc123',
  }

  suite('list operation', () => {
    let client: Client

    beforeEach(async () => {
      client = await TestMCPServer((server) => {
        addConfigurationCapabilities(server, {
          async getConfiguration (projectId: string, _refId: string): Promise<Record<string, unknown>> {
            if (projectId === 'error-project') {
              throw new Error('error message')
            }
            return { configMaps: mockConfigMaps, commitId: 'abc123' }
          },
        } as APIClient)
      })
    })

    test('should return all config maps', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'list',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: JSON.stringify(mockConfigMaps),
          type: 'text',
        },
      ])
    })

    test('should return empty object when no config maps exist', async (t) => {
      const clientEmpty = await TestMCPServer((server) => {
        addConfigurationCapabilities(server, {
          async getConfiguration (): Promise<Record<string, unknown>> {
            return { configMaps: {}, commitId: 'abc123' }
          },
        } as unknown as APIClient)
      })

      const result = await clientEmpty.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'list',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: JSON.stringify({}),
          type: 'text',
        },
      ])
    })

    test('should return error on API failure', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId: 'error-project',
            refId,
            operation: 'list',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error list config map: error message',
          type: 'text',
        },
      ])
    })
  })

  suite('get operation', () => {
    let client: Client

    beforeEach(async () => {
      client = await TestMCPServer((server) => {
        addConfigurationCapabilities(server, {
          async getConfiguration (projectId: string, _refId: string): Promise<Record<string, unknown>> {
            if (projectId === 'error-project') {
              throw new Error('error message')
            }
            return { configMaps: mockConfigMaps, commitId: 'abc123' }
          },
        } as APIClient)
      })
    })

    test('should return specific config map', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'get',
            configMapName: 'app-config',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: JSON.stringify(mockConfigMaps['app-config']),
          type: 'text',
        },
      ])
    })

    test('should return error if config map not found', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'get',
            configMapName: 'non-existent',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error get config map: Config map \'non-existent\' not found',
          type: 'text',
        },
      ])
    })

    test('should return error if configMapName is missing', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'get',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error: configMapName is required for \'get\' operation',
          type: 'text',
        },
      ])
    })

    test('should return error for invalid config map name', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'get',
            configMapName: 'Invalid_Name',
          },
        },
      }, CallToolResultSchema)

      const text: TextContent = result.content[0] as TextContent
      t.assert.match(text.text, /must match Kubernetes DNS-1123 format/)
    })
  })

  suite('create operation', () => {
    let client: Client

    beforeEach(async () => {
      client = await TestMCPServer((server) => {
        addConfigurationCapabilities(server, {
          async getConfiguration (projectId: string, _refId: string): Promise<Record<string, unknown>> {
            if (projectId === 'error-project') {
              throw new Error('error message')
            }
            return { configMaps: mockConfigMaps, commitId: 'abc123' }
          },
          async saveConfiguration (
            _projectId: string,
            _refId: string,
            _resourcesToCreate: ResourcesToCreate,
            _options?: SaveConfigurationOptions,
          ): Promise<SaveResponse> {
            return mockSaveResponse
          },
        } as APIClient)
      })
    })

    test('should create new config map successfully', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'create',
            configMapName: 'new-config',
            files: [
              { name: 'config.json', content: '{}' },
            ],
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Config map \'new-config\' created successfully with 1 file(s).',
          type: 'text',
        },
      ])
    })

    test('should create config map with multiple files', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'create',
            configMapName: 'multi-file-config',
            files: [
              { name: 'app.json', content: '{"key": "value"}' },
              { name: 'settings.yaml', content: 'debug: true' },
              { name: 'env.conf', content: 'ENV=prod' },
            ],
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Config map \'multi-file-config\' created successfully with 3 file(s).',
          type: 'text',
        },
      ])
    })

    test('should return error if config map already exists', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'create',
            configMapName: 'app-config',
            files: [
              { name: 'config.json', content: '{}' },
            ],
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error create config map: Config map \'app-config\' already exists',
          type: 'text',
        },
      ])
    })

    test('should return error if files are missing', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'create',
            configMapName: 'new-config',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error: files are required for \'create\' operation',
          type: 'text',
        },
      ])
    })

    test('should return error for invalid name with uppercase', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'create',
            configMapName: 'MyConfig',
            files: [ { name: 'test.json', content: '{}' } ],
          },
        },
      }, CallToolResultSchema)

      const text: TextContent = result.content[0] as TextContent
      t.assert.match(text.text, /must match Kubernetes DNS-1123 format/)
    })

    test('should return error for name starting with hyphen', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'create',
            configMapName: '-invalid',
            files: [ { name: 'test.json', content: '{}' } ],
          },
        },
      }, CallToolResultSchema)

      const text: TextContent = result.content[0] as TextContent
      t.assert.match(text.text, /must match Kubernetes DNS-1123 format/)
    })
  })

  suite('update operation', () => {
    let client: Client

    beforeEach(async () => {
      client = await TestMCPServer((server) => {
        addConfigurationCapabilities(server, {
          async getConfiguration (projectId: string, _refId: string): Promise<Record<string, unknown>> {
            if (projectId === 'error-project') {
              throw new Error('error message')
            }
            return { configMaps: mockConfigMaps, commitId: 'abc123' }
          },
          async saveConfiguration (
            _projectId: string,
            _refId: string,
            _resourcesToCreate: ResourcesToCreate,
            _options?: SaveConfigurationOptions,
          ): Promise<SaveResponse> {
            return mockSaveResponse
          },
        } as APIClient)
      })
    })

    test('should update existing config map successfully', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'update',
            configMapName: 'app-config',
            files: [
              { name: 'updated.json', content: '{"updated": true}' },
            ],
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Config map \'app-config\' updated successfully with 1 file(s).',
          type: 'text',
        },
      ])
    })

    test('should return error if config map does not exist', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'update',
            configMapName: 'non-existent',
            files: [
              { name: 'config.json', content: '{}' },
            ],
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error update config map: Config map \'non-existent\' does not exist',
          type: 'text',
        },
      ])
    })

    test('should return error if files are missing', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'update',
            configMapName: 'app-config',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error: files are required for \'update\' operation',
          type: 'text',
        },
      ])
    })
  })

  suite('delete operation', () => {
    let client: Client

    beforeEach(async () => {
      client = await TestMCPServer((server) => {
        addConfigurationCapabilities(server, {
          async getConfiguration (projectId: string, _refId: string): Promise<Record<string, unknown>> {
            if (projectId === 'error-project') {
              throw new Error('error message')
            }
            if (projectId === 'project-with-refs') {
              return mockConfigWithReferences
            }
            return { configMaps: mockConfigMaps, services: {}, commitId: 'abc123' }
          },
          async saveConfiguration (
            _projectId: string,
            _refId: string,
            _resourcesToCreate: ResourcesToCreate,
            _options?: SaveConfigurationOptions,
          ): Promise<SaveResponse> {
            return mockSaveResponse
          },
        } as APIClient)
      })
    })

    test('should delete config map successfully', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'delete',
            configMapName: 'db-config',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Config map \'db-config\' deleted successfully.',
          type: 'text',
        },
      ])
    })

    test('should return error if config map does not exist', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'delete',
            configMapName: 'non-existent',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error delete config map: Config map \'non-existent\' does not exist',
          type: 'text',
        },
      ])
    })

    test('should return error if config map is referenced by services', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId: 'project-with-refs',
            refId,
            operation: 'delete',
            configMapName: 'app-config',
          },
        },
      }, CallToolResultSchema)

      const text: TextContent = result.content[0] as TextContent
      t.assert.match(text.text, /Cannot delete config map 'app-config'/)
      t.assert.match(text.text, /api-service/)
    })

    test('should return error if configMapName is missing', async (t) => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'manage_config_maps',
          arguments: {
            projectId,
            refId,
            operation: 'delete',
          },
        },
      }, CallToolResultSchema)

      t.assert.deepEqual(result.content, [
        {
          text: 'Error: configMapName is required for \'delete\' operation',
          type: 'text',
        },
      ])
    })
  })
})

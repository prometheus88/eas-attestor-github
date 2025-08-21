#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '..', '..', '..', 'src', 'generated', 'server', 'controllers');

// Define the mapping of operation IDs to camelCase function names for each service
const serviceConfigs = {
    'SignServiceController.js': {
        exports: {
            'GetServerAddress': 'getServerAddress',
            'ServerSignAttestation': 'serverSignAttestation', 
            'VerifySignature': 'verifySignature'
        }
    },
    'AttestServiceController.js': {
        exports: {
            'CreateAttestation': 'createAttestation',
            'GetSchemas': 'getSchemas',
            'GetSchema': 'getSchema'
        }
    },
    'ContributionServiceController.js': {
        exports: {
            'RegisterRepository': 'registerRepository',
            'GetWebhookSecret': 'getWebhookSecret',
            'ListRegisteredRepositories': 'listRegisteredRepositories',
            'RegisterIdentity': 'registerIdentity',
            'ValidateIdentity': 'validateIdentity',
            'ProcessWebhook': 'processWebhook',
            'GetContributions': 'getContributions',
            'GetContributionsByIdentity': 'getContributionsByIdentity',
            'GetContributionsByRepository': 'getContributionsByRepository',
            'GetContributionsByIdentityUid': 'getContributionsByIdentityUid',
            'GetContributionsByRepositoryUid': 'getContributionsByRepositoryUid',
            'GetLinkedIssues': 'getLinkedIssues',
            'GetPullRequestReviews': 'getPullRequestReviews'
        }
    }
};

// Process each controller
for (const [controllerFile, config] of Object.entries(serviceConfigs)) {
    const controllerPath = path.join(controllersDir, controllerFile);
    
    try {
        let content = fs.readFileSync(controllerPath, 'utf8');
        
        // Generate PascalCase exports
        const pascalCaseExports = Object.entries(config.exports)
            .map(([pascalCase, camelCase]) => `const ${pascalCase} = ${camelCase};`)
            .join('\n');
        
        // Generate module exports with both cases
        const camelCaseList = Object.values(config.exports).join(',\n  ');
        const pascalCaseList = Object.keys(config.exports).join(',\n  ');
        
        // Find and replace the existing module.exports
        const moduleExportsRegex = /module\.exports = \{[^}]*\};/s;
        
        const newModuleExports = `
// PascalCase exports for OpenAPI validator compatibility
${pascalCaseExports}

module.exports = {
  ${camelCaseList},
  ${pascalCaseList},
};`;
        
        content = content.replace(moduleExportsRegex, newModuleExports);
        
        fs.writeFileSync(controllerPath, content, 'utf8');
        console.log(`✅ Fixed exports for ${controllerFile}`);
        
    } catch (error) {
        console.log(`⚠️  Could not process ${controllerFile}: ${error.message}`);
    }
}

console.log('✅ All controller exports fixed');
/**
 * Service registry and factory
 * Provides centralized access to all gRPC services
 */

const AttestService = require('./AttestService');
const SignService = require('./SignService');
const ContributionService = require('./ContributionService');

class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.initialize();
    }

    /**
     * Initialize all services
     */
    initialize() {
        try {
            // Create service instances
            const attestService = new AttestService();
            const signService = new SignService();
            const contributionService = new ContributionService();

            // Register services
            this.services.set('AttestService', attestService);
            this.services.set('SignService', signService);
            this.services.set('ContributionService', contributionService);

            console.log('📋 Service registry initialized with services:', Array.from(this.services.keys()));

        } catch (error) {
            console.error('❌ Failed to initialize service registry:', error.message);
            throw error;
        }
    }

    /**
     * Get a service by name
     * @param {string} serviceName - Name of the service
     * @returns {Object} - Service instance
     */
    getService(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service '${serviceName}' not found`);
        }
        return service;
    }

    /**
     * Get all service names
     * @returns {Array} - Array of service names
     */
    getServiceNames() {
        return Array.from(this.services.keys());
    }

    /**
     * Get all services as gRPC service definitions
     * @returns {Object} - Object with service definitions for gRPC server
     */
    getGrpcServices() {
        const grpcServices = {};
        
        for (const [serviceName, serviceInstance] of this.services) {
            grpcServices[serviceName] = serviceInstance;
        }
        
        return grpcServices;
    }

    /**
     * Health check for all services
     * @returns {Object} - Health status of all services
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {}
        };

        for (const [serviceName, serviceInstance] of this.services) {
            try {
                // Basic health check - ensure service instance exists and has methods
                const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(serviceInstance))
                    .filter(method => method !== 'constructor' && typeof serviceInstance[method] === 'function');

                health.services[serviceName] = {
                    status: 'healthy',
                    methods: methods.length,
                    methodNames: methods
                };

            } catch (error) {
                health.services[serviceName] = {
                    status: 'unhealthy',
                    error: error.message
                };
                health.status = 'degraded';
            }
        }

        return health;
    }
}

// Create singleton instance
const serviceRegistry = new ServiceRegistry();

module.exports = {
    ServiceRegistry,
    serviceRegistry,
    // Export individual services for direct access
    AttestService,
    SignService,
    ContributionService
};
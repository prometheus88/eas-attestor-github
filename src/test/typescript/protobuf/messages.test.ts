/**
 * Unit tests for generated protobuf message types
 * Tests protobuf serialization/deserialization and type safety
 */

import { attestor } from '../../../generated/typescript/attestor/v1/messages';

describe('Protobuf Message Tests', () => {
  describe('Domain Message', () => {
    it('should create and serialize domain messages', () => {
      const domain = new attestor.v1.Domain({
        name: 'GitHub',
        domain: 'github.com'
      });

      expect(domain.name).toBe('GitHub');
      expect(domain.domain).toBe('github.com');

      // Test serialization
      const serialized = domain.serialize();
      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized.length).toBeGreaterThan(0);

      // Test deserialization
      const deserialized = attestor.v1.Domain.deserialize(serialized);
      expect(deserialized.name).toBe('GitHub');
      expect(deserialized.domain).toBe('github.com');
    });

    it('should handle object conversion', () => {
      const domainData = { name: 'GitHub', domain: 'github.com' };
      const domain = attestor.v1.Domain.fromObject(domainData);
      
      expect(domain.name).toBe('GitHub');
      expect(domain.domain).toBe('github.com');

      const object = domain.toObject();
      expect(object).toEqual(domainData);
    });
  });

  describe('Repository Message', () => {
    it('should create repository with domain reference', () => {
      const domain = new attestor.v1.Domain({
        name: 'GitHub',
        domain: 'github.com'
      });

      const repository = new attestor.v1.Repository({
        domain: domain,
        path: 'allendy/test-repo'
      });

      expect(repository.has_domain).toBe(true);
      expect(repository.domain.name).toBe('GitHub');
      expect(repository.path).toBe('allendy/test-repo');

      // Test serialization with nested message
      const serialized = repository.serialize();
      const deserialized = attestor.v1.Repository.deserialize(serialized);
      
      expect(deserialized.has_domain).toBe(true);
      expect(deserialized.domain.name).toBe('GitHub');
      expect(deserialized.path).toBe('allendy/test-repo');
    });
  });

  describe('Identity Message', () => {
    it('should create identity with all fields', () => {
      const domain = new attestor.v1.Domain({
        name: 'GitHub',
        domain: 'github.com'
      });

      const validationSignature = new Uint8Array([1, 2, 3, 4, 5]);

      const identity = new attestor.v1.Identity({
        domain: domain,
        identifier: 'testuser',
        ethereum_address: '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D',
        proof_url: 'https://gist.github.com/testuser/abc123',
        validator: '0x1234567890123456789012345678901234567890',
        validation_signature: validationSignature
      });

      expect(identity.has_domain).toBe(true);
      expect(identity.domain.name).toBe('GitHub');
      expect(identity.identifier).toBe('testuser');
      expect(identity.ethereum_address).toBe('0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D');
      expect(identity.proof_url).toBe('https://gist.github.com/testuser/abc123');
      expect(identity.validation_signature).toEqual(validationSignature);

      // Test serialization with bytes fields
      const serialized = identity.serialize();
      const deserialized = attestor.v1.Identity.deserialize(serialized);
      
      expect(deserialized.identifier).toBe('testuser');
      expect(deserialized.validation_signature).toEqual(validationSignature);
    });
  });

  describe('Contribution Message', () => {
    it('should create contribution with identity and repository', () => {
      const domain = new attestor.v1.Domain({
        name: 'GitHub',
        domain: 'github.com'
      });

      const identity = new attestor.v1.Identity({
        domain: domain,
        identifier: 'testuser',
        ethereum_address: '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D',
        proof_url: 'https://gist.github.com/testuser/abc123'
      });

      const repository = new attestor.v1.Repository({
        domain: domain,
        path: 'allendy/test-repo'
      });

      const identityUid = new Uint8Array(32).fill(1);
      const repoUid = new Uint8Array(32).fill(2);

      const contribution = new attestor.v1.Contribution({
        identity: identity,
        repository: repository,
        url: 'https://github.com/allendy/test-repo/issues/123',
        identity_attestation_uid: identityUid,
        repository_registration_uid: repoUid
      });

      expect(contribution.has_identity).toBe(true);
      expect(contribution.has_repository).toBe(true);
      expect(contribution.identity.identifier).toBe('testuser');
      expect(contribution.repository.path).toBe('allendy/test-repo');
      expect(contribution.url).toBe('https://github.com/allendy/test-repo/issues/123');
      expect(contribution.identity_attestation_uid).toEqual(identityUid);
      expect(contribution.repository_registration_uid).toEqual(repoUid);
    });
  });

  describe('IssueContribution Message', () => {
    it('should create issue contribution with event type', () => {
      const domain = new attestor.v1.Domain({
        name: 'GitHub',
        domain: 'github.com'
      });

      const contribution = new attestor.v1.Contribution({
        url: 'https://github.com/allendy/test-repo/issues/123'
      });

      const issueContribution = new attestor.v1.IssueContribution({
        contribution: contribution,
        event_type: attestor.v1.IssueEvent.ISSUE_EVENT_OPENED
      });

      expect(issueContribution.has_contribution).toBe(true);
      expect(issueContribution.contribution.url).toBe('https://github.com/allendy/test-repo/issues/123');
      expect(issueContribution.event_type).toBe(attestor.v1.IssueEvent.ISSUE_EVENT_OPENED);

      // Test serialization with enum
      const serialized = issueContribution.serialize();
      const deserialized = attestor.v1.IssueContribution.deserialize(serialized);
      
      expect(deserialized.event_type).toBe(attestor.v1.IssueEvent.ISSUE_EVENT_OPENED);
    });
  });

  describe('Enum Values', () => {
    it('should have correct enum values', () => {
      expect(attestor.v1.IssueEvent.ISSUE_EVENT_UNKNOWN).toBe(0);
      expect(attestor.v1.IssueEvent.ISSUE_EVENT_OPENED).toBe(1);
      expect(attestor.v1.IssueEvent.ISSUE_EVENT_RESOLVED).toBe(2);

      expect(attestor.v1.PullRequestEvent.PR_EVENT_UNKNOWN).toBe(0);
      expect(attestor.v1.PullRequestEvent.PR_EVENT_OPENED).toBe(1);
      expect(attestor.v1.PullRequestEvent.PR_EVENT_MERGED).toBe(2);
      expect(attestor.v1.PullRequestEvent.PR_EVENT_CLOSED).toBe(3);

      expect(attestor.v1.ReviewEvent.REVIEW_EVENT_UNKNOWN).toBe(0);
      expect(attestor.v1.ReviewEvent.REVIEW_EVENT_APPROVED).toBe(1);
      expect(attestor.v1.ReviewEvent.REVIEW_EVENT_CHANGES_REQUESTED).toBe(2);

      expect(attestor.v1.WebhookEventType.WEBHOOK_EVENT_UNKNOWN).toBe(0);
      expect(attestor.v1.WebhookEventType.WEBHOOK_EVENT_ISSUES).toBe(1);
      expect(attestor.v1.WebhookEventType.WEBHOOK_EVENT_PULL_REQUEST).toBe(2);
      expect(attestor.v1.WebhookEventType.WEBHOOK_EVENT_PULL_REQUEST_REVIEW).toBe(3);
    });
  });

  describe('Binary Compatibility', () => {
    it('should maintain binary compatibility between serialize methods', () => {
      const domain = new attestor.v1.Domain({
        name: 'GitHub',
        domain: 'github.com'
      });

      const serialized1 = domain.serialize();
      const serialized2 = domain.serializeBinary();
      
      expect(serialized1).toEqual(serialized2);

      const deserialized1 = attestor.v1.Domain.deserialize(serialized1);
      const deserialized2 = attestor.v1.Domain.deserializeBinary(serialized2);
      
      expect(deserialized1.toObject()).toEqual(deserialized2.toObject());
    });
  });

  describe('Field Default Values', () => {
    it('should handle default values correctly', () => {
      const emptyDomain = new attestor.v1.Domain();
      expect(emptyDomain.name).toBe('');
      expect(emptyDomain.domain).toBe('');

      const emptyIdentity = new attestor.v1.Identity();
      expect(emptyIdentity.identifier).toBe('');
      expect(emptyIdentity.ethereum_address).toBe('');
      expect(emptyIdentity.validation_signature).toEqual(new Uint8Array(0));
      expect(emptyIdentity.has_domain).toBe(false);
    });
  });
});
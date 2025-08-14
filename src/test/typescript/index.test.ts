import { main } from '../../main/typescript/index.js';

describe('main function', () => {
    it('should not throw', () => {
        expect(() => main()).not.toThrow();
    });
});

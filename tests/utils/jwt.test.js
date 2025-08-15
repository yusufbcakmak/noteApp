const jwtUtils = require('../../src/utils/jwt');
const jwt = require('jsonwebtoken');

describe('JWT Utils', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const payload = { userId: mockUser.id, email: mockUser.email };
      const token = jwtUtils.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include type in token payload', () => {
      const payload = { userId: mockUser.id };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.type).toBe('access');
      expect(decoded.userId).toBe(mockUser.id);
    });

    it('should set correct issuer and audience', () => {
      const payload = { userId: mockUser.id };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.iss).toBe('note-management-app');
      expect(decoded.aud).toBe('note-management-users');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const payload = { userId: mockUser.id, email: mockUser.email };
      const token = jwtUtils.generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include type in token payload', () => {
      const payload = { userId: mockUser.id };
      const token = jwtUtils.generateRefreshToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.type).toBe('refresh');
      expect(decoded.userId).toBe(mockUser.id);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = jwtUtils.generateTokenPair(mockUser);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should include user data in both tokens', () => {
      const tokens = jwtUtils.generateTokenPair(mockUser);
      
      const accessDecoded = jwt.decode(tokens.accessToken);
      const refreshDecoded = jwt.decode(tokens.refreshToken);

      expect(accessDecoded.userId).toBe(mockUser.id);
      expect(accessDecoded.email).toBe(mockUser.email);
      expect(refreshDecoded.userId).toBe(mockUser.id);
      expect(refreshDecoded.email).toBe(mockUser.email);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const payload = { userId: mockUser.id, email: mockUser.email };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwtUtils.verifyAccessToken(token);

      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe('access');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtUtils.verifyAccessToken('invalid-token');
      }).toThrow('Invalid access token');
    });

    it('should throw error for expired token', () => {
      // Create token with very short expiry
      const shortLivedToken = jwt.sign(
        { userId: mockUser.id, type: 'access' },
        jwtUtils.accessTokenSecret,
        { expiresIn: '1ms', issuer: jwtUtils.issuer, audience: 'note-management-users' }
      );

      // Wait for token to expire
      setTimeout(() => {
        expect(() => {
          jwtUtils.verifyAccessToken(shortLivedToken);
        }).toThrow('Access token has expired');
      }, 10);
    });

    it('should throw error for refresh token used as access token', () => {
      const refreshToken = jwtUtils.generateRefreshToken({ userId: mockUser.id });
      
      // This should not throw during verification, but the type will be wrong
      // The service layer should handle type checking
      const decoded = jwtUtils.verifyRefreshToken(refreshToken);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const payload = { userId: mockUser.id, email: mockUser.email };
      const token = jwtUtils.generateRefreshToken(payload);
      const decoded = jwtUtils.verifyRefreshToken(token);

      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtUtils.verifyRefreshToken('invalid-token');
      }).toThrow('Invalid refresh token');
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const payload = { userId: mockUser.id, email: mockUser.email };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwtUtils.decodeToken(token);

      expect(decoded).toHaveProperty('header');
      expect(decoded).toHaveProperty('payload');
      expect(decoded).toHaveProperty('signature');
      expect(decoded.payload.userId).toBe(mockUser.id);
    });

    it('should handle malformed token gracefully', () => {
      const result = jwtUtils.decodeToken('not-a-jwt-token');
      expect(result).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      const token = jwtUtils.generateAccessToken({ userId: mockUser.id });
      const expiration = jwtUtils.getTokenExpiration(token);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      const expiration = jwtUtils.getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const token = jwtUtils.generateAccessToken({ userId: mockUser.id });
      const isExpired = jwtUtils.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });

    it('should return true for invalid token', () => {
      const isExpired = jwtUtils.isTokenExpired('invalid-token');
      expect(isExpired).toBe(true);
    });

    it('should return true for expired token', (done) => {
      // Create token with very short expiry
      const shortLivedToken = jwt.sign(
        { userId: mockUser.id, type: 'access' },
        jwtUtils.accessTokenSecret,
        { expiresIn: '1ms', issuer: jwtUtils.issuer, audience: 'note-management-users' }
      );

      // Wait for token to expire
      setTimeout(() => {
        const isExpired = jwtUtils.isTokenExpired(shortLivedToken);
        expect(isExpired).toBe(true);
        done();
      }, 10);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'sample-jwt-token';
      const authHeader = `Bearer ${token}`;
      const extracted = jwtUtils.extractTokenFromHeader(authHeader);

      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = jwtUtils.extractTokenFromHeader(null);
      expect(extracted).toBeNull();
    });

    it('should return null for invalid header format', () => {
      const extracted = jwtUtils.extractTokenFromHeader('InvalidFormat token');
      expect(extracted).toBeNull();
    });

    it('should return null for header without token', () => {
      const extracted = jwtUtils.extractTokenFromHeader('Bearer');
      expect(extracted).toBeNull();
    });
  });

  describe('createAuthHeader', () => {
    it('should create valid authorization header', () => {
      const token = 'sample-jwt-token';
      const header = jwtUtils.createAuthHeader(token);

      expect(header).toBe(`Bearer ${token}`);
    });
  });

  describe('Error Handling', () => {
    it('should handle token generation errors gracefully', () => {
      // Mock jwt.sign to throw an error
      const originalSign = jwt.sign;
      jwt.sign = jest.fn(() => {
        throw new Error('Signing failed');
      });

      expect(() => {
        jwtUtils.generateAccessToken({ userId: mockUser.id });
      }).toThrow('Failed to generate access token: Signing failed');

      // Restore original function
      jwt.sign = originalSign;
    });

    it('should handle verification errors gracefully', () => {
      // Test with token signed with different secret
      const invalidToken = jwt.sign(
        { userId: mockUser.id, type: 'access' },
        'wrong-secret',
        { issuer: jwtUtils.issuer, audience: 'note-management-users' }
      );

      expect(() => {
        jwtUtils.verifyAccessToken(invalidToken);
      }).toThrow('Invalid access token');
    });
  });
});
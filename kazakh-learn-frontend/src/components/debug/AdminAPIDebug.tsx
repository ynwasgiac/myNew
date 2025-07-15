// src/components/debug/AdminAPIDebug.tsx - Debug component for admin API

import React, { useState, useEffect } from 'react';
import { adminGuidesAPI } from '../../services/adminGuidesAPI';
import api from '../../services/api';

interface EndpointTest {
  name: string;
  url: string;
  method: string;
  status: 'pending' | 'success' | 'error';
  response?: any;
  error?: string;
}

const AdminAPIDebug: React.FC = () => {
  const [tests, setTests] = useState<EndpointTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [backendInfo, setBackendInfo] = useState<any>(null);

  const endpoints = [
    { name: 'Health Check', url: '/debug/db-health', method: 'GET' },
    { name: 'Admin Guides List', url: '/admin/guides', method: 'GET' },
    { name: 'Admin Words List', url: '/admin/words', method: 'GET' },
    { name: 'Admin Categories List', url: '/admin/categories', method: 'GET' },
    { name: 'Categories (Public)', url: '/categories', method: 'GET' },
    { name: 'Words (Public)', url: '/words', method: 'GET' },
  ];

  useEffect(() => {
    // Get backend info
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await api.get('/debug/db-health');
      setBackendInfo(response.data);
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendInfo({ error: 'Backend unreachable' });
    }
  };

  const runTests = async () => {
    setIsRunning(true);
    const newTests: EndpointTest[] = endpoints.map(ep => ({
      ...ep,
      status: 'pending'
    }));
    setTests(newTests);

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      
      try {
        console.log(`Testing: ${endpoint.method} ${endpoint.url}`);
        
        let response;
        if (endpoint.method === 'GET') {
          response = await api.get(endpoint.url);
        } else {
          throw new Error('Method not implemented in test');
        }

        newTests[i] = {
          ...newTests[i],
          status: 'success',
          response: response.data
        };
      } catch (error: any) {
        console.error(`Failed: ${endpoint.method} ${endpoint.url}`, error);
        
        newTests[i] = {
          ...newTests[i],
          status: 'error',
          error: error.response?.status === 404 
            ? 'Endpoint not found (404)'
            : error.response?.data?.detail || error.message || 'Unknown error'
        };
      }

      setTests([...newTests]);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
    }

    setIsRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '⚪';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Admin API Debug Tool</h2>
          <p className="text-sm text-gray-600 mt-1">
            Test admin endpoints to diagnose connectivity issues
          </p>
        </div>

        <div className="p-6">
          {/* Backend Info */}
          {backendInfo && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Backend Status</h3>
              <pre className="text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(backendInfo, null, 2)}
              </pre>
            </div>
          )}

          {/* Run Tests Button */}
          <div className="mb-6">
            <button
              onClick={runTests}
              disabled={isRunning}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isRunning
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRunning ? 'Running Tests...' : 'Run API Tests'}
            </button>
          </div>

          {/* Test Results */}
          {tests.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">Test Results</h3>
              
              {tests.map((test, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getStatusColor(test.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getStatusIcon(test.status)}</span>
                      <div>
                        <div className="font-medium">
                          {test.method} {test.url}
                        </div>
                        <div className="text-sm opacity-75">{test.name}</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium capitalize">
                      {test.status}
                    </div>
                  </div>

                  {test.error && (
                    <div className="mt-2 text-sm font-medium">
                      Error: {test.error}
                    </div>
                  )}

                  {test.response && test.status === 'success' && (
                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">Response:</div>
                      <pre className="text-xs bg-white p-2 rounded border overflow-x-auto max-h-32">
                        {JSON.stringify(test.response, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Troubleshooting Tips */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">Troubleshooting Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Check if your backend server is running on http://localhost:8000</li>
              <li>• Verify that admin_routes.py is properly imported in main.py</li>
              <li>• Ensure your user has admin role to access admin endpoints</li>
              <li>• Check browser console for detailed error messages</li>
              <li>• Try accessing endpoints directly: <code>curl http://localhost:8000/admin/guides</code></li>
            </ul>
          </div>

          {/* Quick Fixes */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-medium text-green-900 mb-2">Quick Backend Fix</h3>
            <p className="text-sm text-green-800 mb-2">
              If admin endpoints are missing, add this to your main.py:
            </p>
            <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`from admin_routes import admin_router
app.include_router(admin_router)`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAPIDebug;
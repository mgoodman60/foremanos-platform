'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TestResult {
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export default function TestUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const addResult = (type: 'success' | 'error' | 'info', message: string) => {
    setResults(prev => [{
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    }, ...prev]);
  };

  const testUpload = async () => {
    if (!selectedFile) {
      addResult('error', 'No file selected');
      return;
    }

    setTesting(true);
    const startTime = Date.now();

    try {
      addResult('info', `Starting upload test for ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`);

      const formData = new FormData();
      formData.append('file', selectedFile);

      addResult('info', 'Uploading to /api/test-upload...');

      const response = await fetch('/api/test-upload', {
        method: 'POST',
        body: formData,
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const data = await response.json();

      if (response.ok) {
        addResult('success', `✅ Upload Test SUCCESSFUL\n\nTotal Time: ${totalTime}ms\n\n${JSON.stringify(data, null, 2)}`);
      } else {
        addResult('error', `❌ Upload Test FAILED\n\nStatus: ${response.status}\nTotal Time: ${totalTime}ms\n\n${JSON.stringify(data, null, 2)}`);
      }
    } catch (error: any) {
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      addResult('error', `❌ Upload Test ERROR\n\nTotal Time: ${totalTime}ms\nError: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const getResultIcon = (type: TestResult['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getResultClass = (type: TestResult['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              🔧 ForemanOS Upload Diagnostic Tool
            </CardTitle>
            <CardDescription>
              This page helps diagnose upload issues by testing file uploads directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Selection */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Select a File to Test</h3>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx"
                className="mb-4"
              />
              
              {selectedFile && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md text-left">
                  <p><strong>File:</strong> {selectedFile.name}</p>
                  <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB ({selectedFile.size.toLocaleString()} bytes)</p>
                  <p><strong>Type:</strong> {selectedFile.type}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={testUpload}
                disabled={!selectedFile || testing}
                className="flex-1"
              >
                {testing ? 'Testing...' : 'Test Upload'}
              </Button>
              <Button
                onClick={clearResults}
                variant="outline"
              >
                Clear Results
              </Button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Test Results</h3>
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${getResultClass(result.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getResultIcon(result.type)}
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">{result.timestamp}</div>
                        <pre className="text-sm whitespace-pre-wrap font-mono">{result.message}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Instructions */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold mb-2 text-blue-900">📋 Testing Instructions</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Select a file using the file input above</li>
                <li>Click "Test Upload" to start the diagnostic test</li>
                <li>Review the detailed timing and error information</li>
                <li>Share the results with support if issues persist</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('[TEST-UPLOAD START]', new Date().toISOString());
  
  try {
    // Log headers
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');
    console.log('[TEST-UPLOAD] Content-Type:', contentType);
    console.log('[TEST-UPLOAD] Content-Length:', contentLength, 'bytes', contentLength ? `(${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB)` : '');
    
    console.log('[TEST-UPLOAD] Attempting to parse form data...');
    const formDataStart = Date.now();
    
    let formData: FormData;
    let formDataTime = 0;
    try {
      formData = await request.formData();
      formDataTime = Date.now() - formDataStart;
      console.log('[TEST-UPLOAD] Form data parsed in', formDataTime, 'ms');
    } catch (error: any) {
      formDataTime = Date.now() - formDataStart;
      console.error('[TEST-UPLOAD ERROR] Failed to parse form data after', formDataTime, 'ms:', error);
      return NextResponse.json(
        { 
          error: 'Failed to parse form data',
          details: error.message,
          code: error.code,
          timeTaken: formDataTime,
        },
        { status: 400 }
      );
    }
    
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log('[TEST-UPLOAD] File name:', file.name);
    console.log('[TEST-UPLOAD] File size:', file.size, 'bytes', `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    console.log('[TEST-UPLOAD] File type:', file.type);
    
    // Try to read the file
    console.log('[TEST-UPLOAD] Attempting to read file buffer...');
    const bufferStart = Date.now();
    let bufferTime = 0;
    
    try {
      const bytes = await file.arrayBuffer();
      bufferTime = Date.now() - bufferStart;
      const buffer = Buffer.from(bytes);
      console.log('[TEST-UPLOAD] Buffer read in', bufferTime, 'ms, size:', buffer.length, 'bytes');
      
      const totalTime = Date.now() - startTime;
      
      return NextResponse.json(
        {
          success: true,
          fileName: file.name,
          fileSize: file.size,
          fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
          fileType: file.type,
          timings: {
            formDataParse: formDataTime,
            bufferRead: bufferTime,
            total: totalTime,
          },
          message: 'File upload test successful',
        },
        { status: 200 }
      );
    } catch (error: any) {
      bufferTime = Date.now() - bufferStart;
      console.error('[TEST-UPLOAD ERROR] Failed to read buffer after', bufferTime, 'ms:', error);
      return NextResponse.json(
        { 
          error: 'Failed to read file buffer',
          details: error.message,
          code: error.code,
          timeTaken: bufferTime,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('[TEST-UPLOAD ERROR] Failed after', totalTime, 'ms:', error);
    return NextResponse.json(
      { 
        error: 'Test upload failed',
        details: error.message,
        code: error.code,
        timeTaken: totalTime,
      },
      { status: 500 }
    );
  }
}

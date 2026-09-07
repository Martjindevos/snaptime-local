const { capturePhoto, detectCamera } = require('./dist/main/handlers/cameraHandler');

async function test() {
  console.log('Testing camera detection...');
  const status = await detectCamera();
  console.log('Camera status:', status);
  
  console.log('\nTesting file operations (no camera needed)...');
  try {
    // Create temp dir
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const photoPath = path.join(os.tmpdir(), 'test-photos');
    if (!fs.existsSync(photoPath)) {
      fs.mkdirSync(photoPath, { recursive: true });
    }
    console.log('Photo directory created:', photoPath);
    
    // Test directory structure creation
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const classPath = path.join(photoPath, `TestSchool_${dateStr}`, 'Class1A');
    
    if (!fs.existsSync(classPath)) {
      fs.mkdirSync(classPath, { recursive: true });
    }
    console.log('Class directory structure created:', classPath);
    
    // Test file naming logic
    const studentId = 'STU001';
    let filename = `${studentId}.jpg`;
    let filePath = path.join(classPath, filename);
    let counter = 0;
    
    while (fs.existsSync(filePath)) {
      filename = `${studentId}_${counter}.jpg`;
      filePath = path.join(classPath, filename);
      counter++;
    }
    
    console.log('Generated filename:', filename);
    console.log('Full path would be:', filePath);
    
    // Create a dummy file to test
    fs.writeFileSync(filePath, Buffer.from('DUMMY_JPEG_DATA'));
    console.log('✓ Dummy file created successfully');
    console.log('✓ All file operations working');
    
  } catch (err) {
    console.error('✗ Error:', err.message);
  }
}

test();

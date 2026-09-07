const { Dropbox } = require('dropbox');

interface DropboxConfig {
  accessToken: string;
  enabled: boolean;
}

interface DropboxUploadResult {
  success: boolean;
  remoteePath?: string;
  error?: string;
}

class DropboxUploader {
  private dbx: any;
  private enabled: boolean;
  private fs: any;

  constructor(config: DropboxConfig) {
    this.fs = require('fs');
    this.enabled = config.enabled && !!config.accessToken;
    if (this.enabled) {
      try {
        this.dbx = new Dropbox({ accessToken: config.accessToken });
        console.log('[Dropbox] Initialized with token');
      } catch (e) {
        console.error('[Dropbox] Failed to initialize:', e);
        this.enabled = false;
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async uploadPhoto(
    sourcePath: string,
    studentId: string,
    schoolName: string,
    className: string
  ): Promise<DropboxUploadResult> {
    if (!this.enabled) {
      return { success: false, error: 'Dropbox not enabled' };
    }

    try {
      // Check source exists
      if (!this.fs.existsSync(sourcePath)) {
        return { success: false, error: 'Source file not found' };
      }

      // Build remote path: /SnapTime/SchoolName_YYYYMMDD/ClassName/StudentId.jpg
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(
        2,
        '0'
      )}${String(today.getDate()).padStart(2, '0')}`;
      const remotePath = `/SnapTime/${schoolName}_${dateStr}/${className}/${studentId}.jpg`;

      // Read file
      const fileContent = this.fs.readFileSync(sourcePath);

      // Upload to Dropbox
      const response = await this.dbx.filesUpload({
        path: remotePath,
        contents: fileContent,
        autorename: true, // Auto-rename if file exists
      });

      console.log('[Dropbox] Upload successful:', remotePath);
      return {
        success: true,
        remoteePath: response.result.path_display,
      };
    } catch (error: any) {
      console.error('[Dropbox] Upload failed:', error);
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.enabled) {
      console.log('[Dropbox] Not enabled, skipping verify');
      return false;
    }

    try {
      console.log('[Dropbox] Testing connection...');
      const result = await this.dbx.usersGetCurrentAccount();
      console.log('[Dropbox] Connection successful:', result.result.name.display_name);
      return true;
    } catch (error: any) {
      console.error('[Dropbox] Connection failed:', {
        error_summary: error.error_summary,
        message: error.message,
        status: error.status,
        full: error
      });
      return false;
    }
  }
}

export { DropboxUploader };

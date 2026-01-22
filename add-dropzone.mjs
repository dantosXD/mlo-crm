import fs from 'fs';

const filePath = 'frontend/src/pages/ClientDetails.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldFileInput = `          <FileInput
            label="Upload File (optional)"
            placeholder="Click to select file"
            value={selectedFile}
            onChange={(file) => {
              setSelectedFile(file);
              // Auto-fill document name from file name if empty
              if (file && !newDocumentForm.name) {
                const nameWithoutExt = file.name.replace(/\\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                setNewDocumentForm({ ...newDocumentForm, name: nameWithoutExt });
              }
            }}
            accept="*/*"
            clearable
            disabled={savingDocument}
          />`;

const newDropzone = `          <Dropzone
            onDrop={(files: FileWithPath[]) => {
              const file = files[0];
              setSelectedFile(file);
              // Auto-fill document name from file name if empty
              if (file && !newDocumentForm.name) {
                const nameWithoutExt = file.name.replace(/\\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                setNewDocumentForm({ ...newDocumentForm, name: nameWithoutExt });
              }
            }}
            onReject={(files) => {
              notifications.show({
                title: 'File Upload Error',
                message: 'Some files were rejected. Please check the file format and size.',
                color: 'red',
              });
            }}
            maxSize={50 * 1024 * 1024} // 50MB
            accept={[
              'application/pdf',
              'image/png',
              'image/jpeg',
              'image/jpg',
              'image/gif',
              'image/webp',
            ]}
            disabled={savingDocument}
            style={{
              border: '2px dashed var(--mantine-color-blue-5)',
              borderRadius: '8px',
              padding: '40px 20px',
              backgroundColor: selectedFile ? 'var(--mantine-color-blue-0)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Group justify="center" gap="xl" mih={120} style={{ pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <ThemeIcon size={60} color="blue" variant="light">
                  <IconUpload size={30} style={{ width: '30px', height: '30px' }} />
                </ThemeIcon>
              </Dropzone.Accept>
              <Dropzone.Reject>
                <ThemeIcon size={60} color="red" variant="light">
                  <IconUpload size={30} style={{ width: '30px', height: '30px' }} />
                </ThemeIcon>
              </Dropzone.Reject>
              <Dropzone.Idle>
                <ThemeIcon size={60} color="gray" variant="light">
                  <IconUpload size={30} style={{ width: '30px', height: '30px' }} />
                </ThemeIcon>
              </Dropzone.Idle>

              <Box>
                <Text size="xl" inline>
                  {selectedFile ? 'Drag another file or click to replace' : 'Drag files here or click to upload'}
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  Attach PDF or images (max 50MB)
                </Text>
              </Box>
            </Group>
          </Dropzone>`;

content = content.replace(oldFileInput, newDropzone);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Dropzone component added successfully');

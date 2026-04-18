const { nativeImage } = require('electron');
const path = require('node:path');

async function loadImagePayload(filePath) {
  const img = nativeImage.createFromPath(filePath);
  const size = img.getSize();
  if (!size.width || !size.height) {
    throw new Error(`无法读取图片：${filePath}`);
  }

  return {
    fileName: path.basename(filePath),
    filePath,
    width: size.width,
    height: size.height,
    dataUrl: img.toDataURL()
  };
}

module.exports = {
  loadImagePayload
};

const fs = require('node:fs/promises');
const path = require('node:path');
const { PROJECT_EXTENSION } = require('./config.cjs');

function buildProjectFileName(imageMeta) {
  const fileName = imageMeta?.fileName || 'label';
  const base = path.parse(fileName).name || 'label';
  const dir = imageMeta?.filePath ? path.dirname(imageMeta.filePath) : undefined;
  const output = `${base}.${PROJECT_EXTENSION}`;
  return dir ? path.join(dir, output) : output;
}

function buildMaskFileName(imageMeta) {
  const fileName = imageMeta?.fileName || 'label';
  const base = path.parse(fileName).name || 'label';
  const dir = imageMeta?.filePath ? path.dirname(imageMeta.filePath) : undefined;
  const output = `${base}_mask.png`;
  return dir ? path.join(dir, output) : output;
}

function serializeProject(project, projectPath) {
  const clone = JSON.parse(JSON.stringify(project));
  clone.kind = clone.kind || 'wall-label-project';
  clone.version = clone.version || 1;
  clone.meta = clone.meta || {};
  clone.meta.updatedAt = new Date().toISOString();
  clone.meta.createdAt = clone.meta.createdAt || clone.meta.updatedAt;

  if (!clone.image?.filePath) {
    throw new Error('项目中缺少 image.filePath');
  }

  if (projectPath) {
    const imagePath = clone.image.filePath;
    const relative = path.relative(path.dirname(projectPath), imagePath);
    clone.image.filePath = relative;
  }

  return clone;
}

function normalizeProject(project, projectPath) {
  const clone = JSON.parse(JSON.stringify(project));
  if (!clone.image?.filePath) {
    throw new Error('项目文件缺少 image.filePath');
  }

  if (projectPath && !path.isAbsolute(clone.image.filePath)) {
    clone.image.filePath = path.resolve(path.dirname(projectPath), clone.image.filePath);
  }

  clone.kind = clone.kind || 'wall-label-project';
  clone.version = clone.version || 1;
  clone.settings = clone.settings || {};
  clone.settings.defaultWallWidthPx = Math.max(1, Number(clone.settings.defaultWallWidthPx ?? 4));
  clone.settings.snapRadiusPx = Number(clone.settings.snapRadiusPx ?? 10);
  clone.settings.snapToCorners = clone.settings.snapToCorners ?? true;
  clone.settings.theme = clone.settings.theme || 'light';
  clone.settings.showCorners = clone.settings.showCorners ?? true;
  clone.candidateCorners = Array.isArray(clone.candidateCorners) ? clone.candidateCorners : [];
  clone.walls = Array.isArray(clone.walls) ? clone.walls : [];
  clone.meta = clone.meta || {};
  return clone;
}

async function readProjectFile(projectPath) {
  const raw = await fs.readFile(projectPath, 'utf8');
  const parsed = JSON.parse(raw);
  return normalizeProject(parsed, projectPath);
}

async function writeProjectFile(projectPath, project) {
  const serialized = serializeProject(project, projectPath);
  await fs.writeFile(projectPath, JSON.stringify(serialized, null, 2), 'utf8');
  return normalizeProject(serialized, projectPath);
}

module.exports = {
  buildProjectFileName,
  buildMaskFileName,
  serializeProject,
  normalizeProject,
  readProjectFile,
  writeProjectFile
};

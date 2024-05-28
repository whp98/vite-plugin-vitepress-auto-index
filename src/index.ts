import { basename, join } from 'path';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { type Plugin, type ViteDevServer } from 'vite';
import type { IndexPluginOptionType } from './types';

import { DEFAULT_IGNORE_FOLDER, getTimeStr, log } from './utils';

let option: IndexPluginOptionType;

// 尝试从一个md文件中读取标题，读取到第一个 ‘# 标题内容’ 的时候返回这一行
function getTitleFromFile (realFileName: string): string | undefined {
  if (!existsSync(realFileName)) {
    return undefined;
  }
  const fileExtension = realFileName.substring(
    realFileName.lastIndexOf('.') + 1
  );
  if (fileExtension !== 'md' && fileExtension !== 'MD') {
    return undefined;
  }
  // read contents of the file
  const data = readFileSync(realFileName, { encoding: 'utf-8' });
  // split the contents by new line
  const lines = data.split(/\r?\n/);
  // print all lines
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.includes('# ')) {
      return line.replace('# ', '');
    }
  }
  return undefined;
}

/* 用于处理文件命名冲突，避免文件夹出现原始的index.md文件被覆盖的问题
文件夹名称为mybatis下面几种情况如何处理
1. mybatis.md  满足单文件带附件的文章特点，需要保证这个文件夹下面只有一个md，并且和目录名一致，不做处理
2. mybatis.md index.md 这个情况下需要删除index.md 目录下只有一篇文章不要索引文件，并生成备份文件
3. mybatis.md index.md haha.md 这个情况下需要删除mybatis.md 不要和目录名称一致，并生成备份文件
4. haha.md  如果之前没有就新建index.md，如果内容和生成不一致就覆盖掉
5. index.md 需要重命名成为 mybaits.md  因为这个是一篇文章 不需要索引 */
function renameIndexMd (dir: string): void {
  const files = readdirSync(dir);
  // 统计当前文件夹下.md文件数量
  const mdFilesAndFolders = files.filter(f => {
    const stats = statSync(join(dir, f));
    return !DEFAULT_IGNORE_FOLDER.includes(f) &&
      (f.endsWith('.md') || stats.isDirectory());
  });
  const exculdeFolderMds = mdFilesAndFolders.filter(
    f => f !== `${basename(dir)}.md`
  );
  // 检查是否只有一个index.md
  const hasIndexMd = files.includes('index.md');
  const hasFolderMd = files.includes(`${basename(dir)}.md`);
  const hasOtherMd = exculdeFolderMds.length > 0;
  if (hasIndexMd && !hasFolderMd && !hasOtherMd) {
    // 属于有且只有一个index.md
    const folderName = basename(dir);
    const oldPath = join(dir, 'index.md');
    const newPath = join(dir, `${folderName}.md`);
    log('【一个目录下只包含一篇文章和附件】则文件名需要和目录的名字一致!');
    log(`rename ${oldPath} -> ${newPath} `);
    renameSync(oldPath, newPath);
  }
  if (hasIndexMd && hasFolderMd && !hasOtherMd) {
    // 有index.md 也有 mybatis.md 没有其他文件 重命名原来的index.md文件
    const unlinkPath = join(dir, 'index.md');
    const unlinkPathBak = join(dir, `index.md.${getTimeStr()}.del.bak`);
    log(`备份 ${unlinkPath} -> ${unlinkPathBak} `);
    renameSync(unlinkPath, unlinkPathBak);
    log('【一个目录下只包含一篇文章和附件】不能增加额外的索引文件！');
    log(`delete ${unlinkPath}`);
  }
  if (hasIndexMd && hasFolderMd && hasOtherMd) {
    // 有index.md 也有 mybatis.md 也有其他md 重命名 mybatis.md 作为备份代表需要重新命名
    const unlinkPath = join(dir, `${basename(dir)}.md`);
    const unlinkPathBak = join(dir, `${basename(dir)}.md.${getTimeStr()}.del.bak`);
    log(`备份 ${unlinkPath} -> ${unlinkPathBak} `);
    renameSync(unlinkPath, unlinkPathBak);
    log('只有【一个目录下只包含一篇文章和附件】才可以使用文件夹同名md命名！');
    log(`delete ${unlinkPath}`);
  }
  // 递归处理子文件夹
  readdirSync(dir).filter(f => {
    const stats = statSync(join(dir, f));
    return !DEFAULT_IGNORE_FOLDER.includes(f) &&
      (f.endsWith('.md') || stats.isDirectory());
  }).forEach(file => {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      renameIndexMd(filePath);
    }
  });
}

// 排除的文件名
const excludedFiles = DEFAULT_IGNORE_FOLDER;

function generateIndex (dir: string, option: IndexPluginOptionType): void {
  const { mdFilePath = 'docs' } = option;
  const files1 = readdirSync(dir);
  let s = basename(dir);
  if (s === mdFilePath) {
    s = '目录';
  }
  let indexContent = `# ${s}\n`;
  let files = files1.sort((a: string, b: string): number => {
    const statsA = statSync(join(dir, a));
    const statsB = statSync(join(dir, b));
    /* if (statsA.isDirectory() && statsB.isDirectory()) {
      return statsB.mtimeMs - statsA.mtimeMs;
    } else if (statsA.isDirectory() && statsB.isFile()) {
      return 1;
    } else if (statsA.isFile() && statsB.isDirectory()) {
      return -1;
    } else {
      return statsB.mtimeMs - statsA.mtimeMs;
    } */
    return statsB.mtimeMs - statsA.mtimeMs;
  });
  // 过滤排除的目录
  const filtered = files.filter(f => {
    const stats = statSync(join(dir, f));
    return !DEFAULT_IGNORE_FOLDER.includes(f) &&
      (f.endsWith('.md') || stats.isDirectory());
  });
  if (filtered.length === 1) {
    // 如果排除后只剩一个同名md文件,则跳过并且删除原来的index.md
    if (filtered[0] === `${basename(dir)}.md`) {
      // 删除已存在的 index.md
      const indexPath = join(dir, 'index.md');
      const existsSync1 = existsSync(indexPath);
      if (existsSync1) {
        const unlinkPathBak = join(dir, `index.md.${getTimeStr()}.del.bak`);
        log(`备份 ${indexPath} -> ${unlinkPathBak} `);
        renameSync(indexPath, unlinkPathBak);
        log(`delete ${indexPath}`);
        files = files.filter(f => f !== 'index.md');
      }
    } else {
      // 如果只有一个md文件但是名称和目录不一致则应该删除这个目录下和目录同名的md
      // 目录同名的只应该存在于有附件的文章内
      const indexPath = join(dir, `${basename(dir)}.md`);
      const existsSync1 = existsSync(indexPath);
      if (existsSync1) {
        const unlinkPathBak = join(dir, `${basename(dir)}.md.${getTimeStr()}.del.bak`);
        log(`备份 ${indexPath} -> ${unlinkPathBak} `);
        renameSync(indexPath, unlinkPathBak);
        log(`delete ${indexPath}`);
        files = files.filter(f => f !== `${basename(dir)}.md`);
      }
    }
  }
  if (filtered.length > 1 && filtered.includes(`${basename(dir)}.md`)) {
    // 删除目录同名的MD文件
    const indexPath = join(dir, `${basename(dir)}.md`);
    const existsSync1 = existsSync(indexPath);
    if (existsSync1) {
      const unlinkPathBak = join(dir, `${basename(dir)}.md.${getTimeStr()}.del.bak`);
      log(`备份 ${indexPath} -> ${unlinkPathBak} `);
      renameSync(indexPath, unlinkPathBak);
      log(`delete ${indexPath}`);
      files = files.filter(f => f !== `${basename(dir)}.md`);
    }
  }
  for (const file of files) {
    if (excludedFiles.includes(file)) continue;
    const filePath = join(dir, file);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      const title1 = getTitleFromFile(join(filePath, 'index.md'));
      const title2 = getTitleFromFile(join(filePath, 'index.MD'));
      const title3 = getTitleFromFile(join(filePath, file + '.md'));
      let out = file;
      if (title1) {
        out = title1;
      } else if (title2) {
        out = title2;
      } else if (title3) {
        out = title3;
      }
      // 递归处理子文件夹
      generateIndex(filePath, option);
      if (existsSync(join(dir, file, 'index.md'))) {
        indexContent += `- [${out}](./${file}/)\n`;
      } else if (existsSync(join(dir, file, `${file}.md`))) {
        indexContent += `- [${out}](./${file}/${file}.md)\n`;
      }
    } else if (file.endsWith('.md')) {
      const title = getTitleFromFile(filePath);
      let out = file;
      if (title) {
        out = title;
      }
      indexContent += `- [${out}](./${file})\n`;
    }
  }
  // 如果不包含文件夹同名文件就写入到index.md中
  if (!files.includes(`${basename(dir)}.md`)) {
    writeIfDifferent(dir, 'index.md', indexContent);
  }
}

function writeIfDifferent (dir: string, fileName: string, content: string): void {
  const filePath = join(dir, fileName);
  // 检查文件是否存在
  if (existsSync(filePath)) {
    // 读取现有文件的内容
    const existingContent = readFileSync(filePath, 'utf8');
    // 如果现有内容和要写入的内容一致，则不写入
    if (existingContent === content) {
      // log('文件内容一致，不需要写入');
      return;
    }
  }
  // 写入新内容
  writeFileSync(filePath, content);
  log(filePath + ' 文件已写入');
}
export default function VitePluginVitePressAutoIndex (
  opt: IndexPluginOptionType = {}
): Plugin {
  return {
    name: 'vite-plugin-vitepress-auto-index',
    configureServer ({
      watcher,
      restart
    }: ViteDevServer) {
      option = opt;
      const { mdFilePath = 'docs' } = option;
      const fsWatcher = watcher.add(join(process.cwd(), mdFilePath));
      fsWatcher.on('all', async (event) => {
        if (event === 'addDir') {
          log('watch addDir ');
          await restart();
          return;
        }
        if (event === 'unlinkDir') {
          log('watch unlinkDir');
          await restart();
          return;
        }
        if (event === 'add') {
          log('watch add');
          await restart();
          return;
        }
        if (event === 'unlink') {
          log('watch unlink');
          await restart();
          return;
        }
        if (event === 'change') {
          log('watch change');
          await restart();
        }
      });
    },
    config (config) {
      option = opt;
      const { mdFilePath = 'docs' } = option;
      // 入口目录
      const docsRoot = join(process.cwd(), mdFilePath);
      log('begin rename 重命名');
      renameIndexMd(docsRoot);
      log('finsh rename 重命名');
      generateIndex(docsRoot, option);
      log('index generate finish!');
      return config;
    }
  };
}

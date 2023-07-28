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

/* folder mybatis 下面几种情况如何处理
1. mybatis.md   需要保证这个文件夹下面只有一个md
2. mybatis.md index.md 这个情况下需要删除index.md
3. mybatis.md index.md haha.md 这个情况下需要删除mybatis.md
4. haha.md  新建index.md
5. index.md 需要重命名成为 mybaits.md */
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
    const unlinkPath = join(dir, 'index.md');
    const unlinkPathBak = join(dir, `index.md.${getTimeStr()}.del.bak`);
    log(`备份 ${unlinkPath} -> ${unlinkPathBak} `);
    renameSync(unlinkPath, unlinkPathBak);
    log('【一个目录下只包含一篇文章和附件】不能增加额外的索引文件！');
    log(`delete ${unlinkPath}`);
  }
  if (hasIndexMd && hasFolderMd && hasOtherMd) {
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

function generateIndex (dir: string): void {
  const files1 = readdirSync(dir);
  let indexContent = `# ${basename(dir)}\n`;
  let files = files1.sort((a: string, b: string): number => {
    const statsA = statSync(join(dir, a));
    const statsB = statSync(join(dir, b));
    if (statsA.isDirectory() && statsB.isDirectory()) {
      return 0;
    } else if (statsA.isDirectory() && statsB.isFile()) {
      return 1;
    } else if (statsA.isFile() && statsB.isDirectory()) {
      return -1;
    } else {
      return 0;
    }
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
      return;
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
      generateIndex(filePath);
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
  writeFileSync(join(dir, 'index.md'), indexContent);
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
      log('begin rename title/index.md to title/title.md');
      renameIndexMd(docsRoot);
      log('finsh rename title/index.md to title/title.md');
      generateIndex(docsRoot);
      log('index generate finish!');
      return config;
    }
  };
}

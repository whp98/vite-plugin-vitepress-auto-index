import { basename, join } from 'path';
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { type Plugin, type ViteDevServer } from 'vite';
import type { IndexPluginOptionType } from './types';

import { DEFAULT_IGNORE_FOLDER, log } from './utils';

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

// 排除的文件名
const excludedFiles = DEFAULT_IGNORE_FOLDER;

function generateIndex (dir: string): void {
  const files1 = readdirSync(dir);
  let indexContent = `# ${basename(dir)}\n`;
  const files = files1.sort((a: string, b: string): number => {
    const statsA = statSync(join(dir, a));
    const statsB = statSync(join(dir, a));
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
  const filtered = files.filter(f => !DEFAULT_IGNORE_FOLDER.includes(f));

  // 如果排除后只剩一个同名md文件,则跳过并且删除原来的index.md
  if (filtered.length === 1 && filtered[0] === `${basename(dir)}.md`) {
    // 删除已存在的 index.md
    const indexPath = join(dir, 'index.md');
    if (existsSync(indexPath)) {
      unlinkSync(indexPath);
    }
    return;
  }
  for (const file of files) {
    if (excludedFiles.includes(file)) continue;
    const filePath = join(dir, file);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      const title = getTitleFromFile(filePath);
      let out = file;
      if (title) {
        out = title;
      }
      indexContent += `- [${out}](./${file}/)\n`;
      generateIndex(filePath); // 递归处理子文件夹
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
      const fsWatcher = watcher.add('*.md');
      fsWatcher.on('all', async (event, path) => {
        if (event !== 'change') {
          log(`${event} ${path}`);
          try {
            await restart();
            log('update sidebar...');
          } catch {
            log(`${event} ${path}`);
            log('update sidebar failed');
          }
        }
      });
    },
    config (config) {
      option = opt;
      // 入口目录
      const docsRoot = join(process.cwd(), 'docs');
      generateIndex(docsRoot);
      log('index generate finish! 1111');
      return config;
    }
  };
}

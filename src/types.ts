import type { SiteConfig } from 'vitepress';

export interface IndexPluginOptionType {
  // 指定md文件路径
  mdFilePath?: string
}

export interface UserConfig {
  vitepress: SiteConfig
}

# 自牧英语

个人英语学习工具，基于新概念英语第一册。

## 项目结构

```
zimu-english/
├── src/                 # 源码
│   ├── index.html       # 主应用（单 HTML + JS + CSS）
│   └── content.js       # 内容数据（单词、课文、文章等）
├── dist/                # 构建产物（单文件，可部署）
│   └── index.html
├── build.ps1            # 构建脚本
└── README.md
```

## 构建

```powershell
.\build.ps1 -Version "1.0.0"
```

可选参数：
- `-Version "x.y.z"` — 指定版本号（注入 HTML 注释）
- `-Minify` — 启用基础压缩

输出在 `dist/` 目录。

## 部署

项目通过 GitHub Pages 部署在根域名：
<https://[你的用户名].github.io/zimu-english/>

### 手动更新

```powershell
.\build.ps1
git add -A
git commit -m "描述"
git push
```

GitHub Pages 会自动从 main 分支根目录部署。

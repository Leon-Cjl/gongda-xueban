// 发布版构建用：去掉 app 副本里 .js / .css 的整行注释和块注释（开发说明不随安装包分发）。
// 只处理从行首开始的注释，不碰字符串里的 "//"（例如网址）。用法：node strip-comments.cjs <目录>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
for (const name of fs.readdirSync(dir)) {
 if (!/\.(js|css)$/.test(name)) continue;
 const file = path.join(dir, name);
 let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
 text = text.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n?/gm, '');
 text = text.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
 fs.writeFileSync(file, text);
}

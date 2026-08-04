// 环境配置：预览/真机测试时只改这一个文件
// 注意：Web 后端 basePath 是 /interview，必须带此前缀
// - 生产（默认，与 Web 数据互通）：'https://47.116.138.61/interview'
// - 本地开发（模拟器）：'http://localhost:3000/interview'
// - 真机连本地（同一 Wi-Fi）：'http://192.168.31.219:3000/interview'
// 正式发布需：有效 HTTPS 证书 + ICP 备案域名 + 微信后台配置 request 合法域名
module.exports = {
  baseUrl: 'https://47.116.138.61/interview',
}

// 环境配置：预览/真机测试时只改这一个文件
// 注意：Web 后端 basePath 是 /interview，必须带此前缀
// - 生产（默认，与 Web 数据互通）：'https://mianshi.pro/interview'
//   小程序正式发布前需在微信公众平台把 mianshi.pro 加入 request/downloadFile 合法域名
// - 本地开发（模拟器）：'http://localhost:3000/interview'
// - 真机连本地（同一 Wi-Fi）：'http://192.168.31.219:3000/interview'
module.exports = {
  baseUrl: 'https://mianshi.pro/interview',
}

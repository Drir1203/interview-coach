// 环境配置：预览/真机测试时只改这一个文件
// 注意：Web 后端 basePath 是 /interview，必须带此前缀
// - 开发者工具模拟器：'http://localhost:3000/interview'
// - 真机预览（同一 Wi-Fi，需放行 3000 端口）：'http://192.168.31.219:3000/interview'
// - 生产服务器（HTTP，需开发者工具勾选"不校验合法域名"）：'http://47.116.138.61/interview'
// - 正式上线必须用 HTTPS 域名（微信 request 合法域名要求 HTTPS）
module.exports = {
  baseUrl: 'http://192.168.31.219:3000/interview',
}

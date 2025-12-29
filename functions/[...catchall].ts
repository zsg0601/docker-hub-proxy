/**
 * Cloudflare Pages Functions Docker Hub 镜像代理（小白专用，无需修改）
 */
export const onRequest = async (context: {
  request: Request;
  env: Env;
  params: { catchall: string[] };
}) => {
  const { request, params } = context;
  const rawUrl = new URL(request.url);
  
  // 转发到Docker Hub官方地址
  const dockerHubHost = "registry-1.docker.io";
  const catchallPath = params.catchall.join("/");
  const dockerHubUrl = `https://${dockerHubHost}/${catchallPath}${rawUrl.search}`;
  
  // 构造请求头，适配Docker拉取逻辑
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Host", dockerHubHost);
  requestHeaders.set("Referer", `https://${dockerHubHost}/`);
  requestHeaders.delete("CF-Connecting-IP");
  requestHeaders.delete("CF-IPCountry");
  
  try {
    // 发送代理请求并配置缓存
    const proxyResponse = await fetch(dockerHubUrl, {
      method: request.method,
      headers: requestHeaders,
      body: request.method === "GET" || request.method === "HEAD" ? null : await request.blob(),
      redirect: "follow",
      cf: {
        cacheTtl: 86400, // 缓存24小时，后续拉取更快
        cacheEverything: true,
        polish: "off", // 不优化二进制数据，避免镜像损坏
      },
    });
    
    // 构造返回响应，允许跨域
    const responseHeaders = new Headers(proxyResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    responseHeaders.delete("Set-Cookie");
    
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("代理失败：", error);
    return new Response(`代理请求失败，请检查网络：${(error as Error).message}`, {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};

// 环境变量类型声明（无需修改）
interface Env {}

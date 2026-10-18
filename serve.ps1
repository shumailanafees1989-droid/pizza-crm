param([int]$Port = 5173, [string]$Root = $PSScriptRoot)

$csharp = @"
using System;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;

public class FastServer {
    private HttpListener _listener;
    private string _root;
    private volatile bool _running;
    private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { ".html", "text/html; charset=utf-8" },
        { ".js", "text/javascript; charset=utf-8" },
        { ".mjs", "text/javascript; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".svg", "image/svg+xml" },
        { ".png", "image/png" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".ico", "image/x-icon" },
        { ".env", "text/plain; charset=utf-8" }
    };

    public void Start(string root, int port) {
        _root = Path.GetFullPath(root);
        _listener = new HttpListener();
        _listener.Prefixes.Add("http://localhost:" + port + "/");
        _listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
        _listener.Start();
        _running = true;

        Task.Run(async () => {
            while (_running) {
                try {
                    var context = await _listener.GetContextAsync();
                    ThreadPool.QueueUserWorkItem(s => ProcessRequest((HttpListenerContext)s), context);
                } catch {
                    if (!_running) break;
                }
            }
        });
    }

    private void ProcessRequest(HttpListenerContext ctx) {
        try {
            string raw = Uri.UnescapeDataString(ctx.Request.Url.AbsolutePath);
            if (string.IsNullOrEmpty(raw) || raw == "/") raw = "/index.html";
            string rel = raw.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            string file = Path.GetFullPath(Path.Combine(_root, rel));

            if (file.StartsWith(_root, StringComparison.OrdinalIgnoreCase) && File.Exists(file)) {
                string ext = Path.GetExtension(file);
                string mime = MimeTypes.ContainsKey(ext) ? MimeTypes[ext] : "application/octet-stream";
                byte[] data = File.ReadAllBytes(file);
                ctx.Response.ContentType = mime;
                ctx.Response.ContentLength64 = data.Length;
                ctx.Response.Headers.Add("Cache-Control", "no-store");
                ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                ctx.Response.StatusCode = 200;
                ctx.Response.OutputStream.Write(data, 0, data.Length);
            } else {
                ctx.Response.StatusCode = 404;
            }
        } catch {
            try { ctx.Response.StatusCode = 500; } catch {}
        } finally {
            try {
                ctx.Response.OutputStream.Close();
                ctx.Response.Close();
            } catch {}
        }
    }

    public void Stop() {
        _running = false;
        try { _listener.Stop(); _listener.Close(); } catch {}
    }
}
"@

Add-Type -TypeDefinition $csharp -Language CSharp

$srv = New-Object FastServer
try {
  $srv.Start($Root, $Port)
} catch {
  Write-Host "Could not start server on port ${Port}: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "🍕 Pizza CRM is running!" -ForegroundColor Yellow
Write-Host "👉 Open in your browser: http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "👉 Or alternative link:  http://127.0.0.1:$Port/" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server."

try {
  while ($true) {
    Start-Sleep -Seconds 1
  }
} finally {
  $srv.Stop()
}

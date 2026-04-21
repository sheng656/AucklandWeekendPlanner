#!/usr/bin/env pwsh

# ===================================
# Auckland Weekend Planner 部署脚本
# ===================================

param(
    [Parameter(Mandatory = $false)]
    [string]$Action = "help"
)

# 颜色输出
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error-Custom { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Warning-Custom { Write-Host "⚠️  $args" -ForegroundColor Yellow }

# 检查 AWS CLI
function Check-AWS-CLI {
    Write-Info "检查 AWS CLI 状态..."
    $result = aws --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "AWS CLI 已安装: $result"
        return $true
    } else {
        Write-Error-Custom "AWS CLI 未安装"
        Write-Info "请下载安装: https://aws.amazon.com/cli/"
        return $false
    }
}

# 检查 AWS 凭证
function Check-AWS-Credentials {
    Write-Info "检查 AWS 凭证状态..."
    $result = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "AWS 凭证已配置"
        Write-Info "账户信息:"
        aws sts get-caller-identity | ConvertFrom-Json | Format-List
        return $true
    } else {
        Write-Error-Custom "AWS 凭证未配置"
        Write-Info "请运行: aws configure"
        return $false
    }
}

# 检查 Bedrock 访问
function Check-Bedrock-Access {
    Write-Info "检查 Bedrock 访问..."
    $result = aws bedrock list-foundation-models --region ap-southeast-2 2>&1
    if ($LASTEXITCODE -eq 0) {
        $models = ($result | ConvertFrom-Json).modelSummaries
        $haiku = $models | Where-Object { $_.modelId -like "*claude-3-haiku*" }
        if ($haiku) {
            Write-Success "Bedrock Claude 3 Haiku 访问已启用"
            return $true
        }
    }
    Write-Error-Custom "Bedrock Claude 3 Haiku 访问未启用"
    Write-Info "请在 AWS Console 中请求访问: https://console.aws.amazon.com/bedrock/home#/overview"
    return $false
}

# 配置 SSM 参数
function Setup-SSM-Parameters {
    Write-Info "配置 SSM Parameter Store..."
    
    # 读取用户输入
    $eventfindaUser = Read-Host "输入 Eventfinda Username"
    $eventfindaPass = Read-Host "输入 Eventfinda Password" -AsSecureString
    $openweatherKey = Read-Host "输入 OpenWeather API Key"
    
    # 转换 SecureString 为明文
    $eventfindaPassPlain = [System.Net.NetworkCredential]::new("", $eventfindaPass).Password
    
    try {
        Write-Info "创建 SSM 参数..."
        
        # Eventfinda Username
        aws ssm put-parameter `
            --name "/AucklandPlanner/Config/EVENTFINDA_USERNAME" `
            --value "$eventfindaUser" `
            --type "String" `
            --overwrite `
            --region ap-southeast-2 | Out-Null
        Write-Success "✓ EVENTFINDA_USERNAME 已创建"
        
        # Eventfinda Password
        aws ssm put-parameter `
            --name "/AucklandPlanner/Config/EVENTFINDA_PASSWORD" `
            --value "$eventfindaPassPlain" `
            --type "SecureString" `
            --overwrite `
            --region ap-southeast-2 | Out-Null
        Write-Success "✓ EVENTFINDA_PASSWORD 已创建"
        
        # OpenWeather API Key
        aws ssm put-parameter `
            --name "/AucklandPlanner/Config/OPENWEATHER_API_KEY" `
            --value "$openweatherKey" `
            --type "SecureString" `
            --overwrite `
            --region ap-southeast-2 | Out-Null
        Write-Success "✓ OPENWEATHER_API_KEY 已创建"
        
        # 验证参数
        Write-Info "验证 SSM 参数..."
        $params = aws ssm get-parameters-by-path `
            --path "/AucklandPlanner/Config" `
            --region ap-southeast-2 | ConvertFrom-Json
        
        Write-Success "已创建 $($params.Parameters.Count) 个 SSM 参数"
        return $true
    } catch {
        Write-Error-Custom "SSM 参数配置失败: $_"
        return $false
    }
}

# 部署 CDK Stack
function Deploy-CDK-Stack {
    Write-Info "部署 CDK Stack..."
    
    Push-Location ".\infrastructure"
    
    try {
        # 安装依赖
        Write-Info "安装 npm 依赖..."
        npm install | Out-Null
        Write-Success "✓ npm 依赖已安装"
        
        # 构建 TypeScript
        Write-Info "构建 TypeScript..."
        npm run build | Out-Null
        Write-Success "✓ TypeScript 已构建"
        
        # 检查变更
        Write-Info "检查 CloudFormation 变更..."
        npx cdk diff
        
        # 确认部署
        $confirm = Read-Host "确认部署? (y/n)"
        if ($confirm -ne 'y') {
            Write-Info "部署已取消"
            return $false
        }
        
        # 部署
        Write-Info "正在部署 CDK Stack (这可能需要 5-10 分钟)..."
        $output = npx cdk deploy --require-approval=never 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✓ CDK Stack 部署成功!"
            
            # 提取 API URL
            $apiUrl = $output | Select-String "InfrastructureStack.ApiV2Url = (.+)"
            if ($apiUrl) {
                $url = $apiUrl.Matches[0].Groups[1].Value
                Write-Success "API URL: $url"
                Write-Info "请复制并保存此 URL，用于前端配置"
                return $url
            }
            return $true
        } else {
            Write-Error-Custom "CDK Stack 部署失败"
            return $false
        }
    } catch {
        Write-Error-Custom "部署异常: $_"
        return $false
    } finally {
        Pop-Location
    }
}

# 配置前端环境
function Setup-Frontend-Env {
    param(
        [string]$ApiUrl
    )
    
    if (-not $ApiUrl) {
        $ApiUrl = Read-Host "输入 API 端点 URL"
    }
    
    Write-Info "配置前端环境变量..."
    
    $envContent = @"
# Auckland Weekend Planner 前端配置
NEXT_PUBLIC_API_URL=$ApiUrl
"@
    
    $envFile = ".\frontend\.env.local"
    
    try {
        Set-Content -Path $envFile -Value $envContent
        Write-Success "✓ .env.local 已创建"
        Write-Info "API URL 已配置为: $ApiUrl"
        return $true
    } catch {
        Write-Error-Custom "环境配置失败: $_"
        return $false
    }
}

# 启动前端开发服务器
function Start-Frontend-Dev {
    Write-Info "启动前端开发服务器..."
    
    Push-Location ".\frontend"
    
    try {
        npm run dev
    } catch {
        Write-Error-Custom "启动开发服务器失败: $_"
    } finally {
        Pop-Location
    }
}

# 主菜单
function Show-Menu {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   Auckland Weekend Planner - 部署工具              ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 检查前置条件 (AWS CLI, 凭证, Bedrock)"
    Write-Host "2. 配置 SSM 参数 (Eventfinda, OpenWeather)"
    Write-Host "3. 部署 CDK Stack"
    Write-Host "4. 配置前端环境"
    Write-Host "5. 启动前端开发服务器"
    Write-Host "6. 完整部署流程 (1-5 全部)"
    Write-Host "7. 查看部署指南"
    Write-Host "8. 退出"
    Write-Host ""
}

# 完整部署流程
function Full-Deployment {
    Write-Info "开始完整部署流程..."
    
    # 步骤 1: 检查前置条件
    if (-not (Check-AWS-CLI)) {
        Write-Error-Custom "请先安装 AWS CLI"
        return
    }
    
    if (-not (Check-AWS-Credentials)) {
        Write-Error-Custom "请先配置 AWS 凭证"
        return
    }
    
    if (-not (Check-Bedrock-Access)) {
        Write-Warning-Custom "Bedrock 访问未启用，请在 AWS Console 中启用后重试"
        return
    }
    
    # 步骤 2: 配置 SSM 参数
    if (-not (Setup-SSM-Parameters)) {
        return
    }
    
    # 步骤 3: 部署 CDK Stack
    $apiUrl = Deploy-CDK-Stack
    if (-not $apiUrl) {
        return
    }
    
    # 步骤 4: 配置前端环境
    if (-not (Setup-Frontend-Env -ApiUrl $apiUrl)) {
        return
    }
    
    Write-Success "所有步骤已完成！🎉"
    Write-Info "现在您可以运行 'npm run dev' 启动前端开发服务器"
}

# 提示用户查看部署指南
function Show-Deployment-Guide {
    Write-Host ""
    Write-Info "请查看详细部署指南: DEPLOYMENT_GUIDE.md"
    if (Test-Path "DEPLOYMENT_GUIDE.md") {
        Get-Content "DEPLOYMENT_GUIDE.md" -Head 50
    }
}

# 主程序
switch ($Action.ToLower()) {
    "check" {
        Write-Info "检查前置条件..."
        Check-AWS-CLI | Out-Null
        Check-AWS-Credentials | Out-Null
        Check-Bedrock-Access | Out-Null
    }
    "params" {
        Setup-SSM-Parameters
    }
    "deploy" {
        Deploy-CDK-Stack
    }
    "setup-frontend" {
        $apiUrl = Read-Host "输入 API 端点 URL (从 CDK 部署输出)"
        Setup-Frontend-Env -ApiUrl $apiUrl
    }
    "dev" {
        Start-Frontend-Dev
    }
    "full" {
        Full-Deployment
    }
    "guide" {
        Show-Deployment-Guide
    }
    default {
        Show-Menu
        while ($true) {
            $choice = Read-Host "请选择操作 (1-8)"
            switch ($choice) {
                "1" { Check-AWS-CLI; Check-AWS-Credentials; Check-Bedrock-Access; break }
                "2" { Setup-SSM-Parameters; break }
                "3" { Deploy-CDK-Stack; break }
                "4" { Setup-Frontend-Env; break }
                "5" { Start-Frontend-Dev; break }
                "6" { Full-Deployment; break }
                "7" { Show-Deployment-Guide; break }
                "8" { Write-Info "退出"; exit }
                default { Write-Warning-Custom "无效选择"; break }
            }
            Read-Host "按 Enter 继续"
            Clear-Host
            Show-Menu
        }
    }
}

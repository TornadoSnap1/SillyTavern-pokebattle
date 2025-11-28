// index.js (v6.4 Final - Anti-Plugin Mode)
console.log("🛡️ [Poké-Switch] 插件对抗模式 (v6.4) 已启动");

// ==========================================
// 1. 战斗启动器 (Iframe Launcher)
// ==========================================
window.launchPokemonBattle = function(encodedData) {
    let battleData;
    try {
        battleData = JSON.parse(decodeURIComponent(encodedData));
    } catch (e) {
        alert("❌ 错误：战斗数据损坏");
        console.error(e);
        return;
    }

    console.log("🚀 [Poké-Switch] 启动战斗 Iframe...", battleData);

    // --- 创建遮罩层 ---
    const overlay = document.createElement('div');
    overlay.id = 'pk-battle-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85); z-index: 20000;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.3s;
    `;

    // --- 创建 Iframe ---
    // 路径指向扩展目录下的 battle.html
    const iframe = document.createElement('iframe');
    iframe.src = "scripts/extensions/st-poke-battle/battle.html"; 
    iframe.style.cssText = `
        width: 95%; height: 90%; border: none; 
        border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        background: #202020;
    `;

    // --- 创建关闭按钮 ---
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = "❌ 结束战斗 (Close)";
    closeBtn.style.cssText = `
        margin-top: 10px; padding: 8px 20px; 
        background: #ef4444; color: white; border: none; border-radius: 4px;
        font-weight: bold; cursor: pointer; font-size: 14px;
    `;
    closeBtn.onclick = function() {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if(document.body.contains(overlay)) document.body.removeChild(overlay);
        }, 300);
    };

    // --- 通信逻辑 ---
    iframe.onload = function() {
        // 延时发送，确保 Iframe 内部 JS 准备就绪
        setTimeout(() => {
            const message = { type: 'START_BATTLE', payload: battleData };
            console.log("📤 [Poké-Switch] 发送 START_BATTLE 指令");
            iframe.contentWindow.postMessage(message, '*');
        }, 500);
    };

    // 挂载到页面
    overlay.appendChild(iframe);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    
    // 触发淡入
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
};

// ==========================================
// 2. 核心处理逻辑 (Processor)
// ==========================================
function processMessageNode(node) {
    // 必须是 DOM 元素
    if (!node || node.nodeType !== 1) return;
    
    const rawText = node.innerText;
    
    // 1. 基础检查：必须包含完整暗号
    if (!rawText.includes('[pkbattlestart]') || !rawText.includes('[pkbattleend]')) return;

    // 2. 状态检查：即使标记了 processed，也要检查按钮是否真的在
    // (应对 SillyTavern 插件覆盖 DOM 的情况)
    const existingBtn = node.querySelector('.pk-battle-btn-container');
    if (node.getAttribute('data-pk-processed') === 'true' && existingBtn) {
        return; // 真的处理好了，跳过
    }

    // console.log("⚔️ [Poké-Switch] 检测到待处理的战斗数据...");

    // 3. 解析数据
    const startTag = '[pkbattlestart]';
    const endTag = '[pkbattleend]';
    const startIndex = rawText.indexOf(startTag);
    const endIndex = rawText.lastIndexOf(endTag);
    if (startIndex === -1 || endIndex === -1) return;

    let jsonString = rawText.substring(startIndex + startTag.length, endIndex).trim();
    // 清洗 Markdown 代码块符号
    jsonString = jsonString.replace(/```json/gi, '').replace(/```/g, '');
    
    // 解码 HTML 实体 (防止 &quot; 等问题)
    const txt = document.createElement("textarea");
    txt.innerHTML = jsonString;
    
    let battleData;
    try { 
        battleData = JSON.parse(txt.value); 
    } catch (e) { 
        console.error("❌ [Poké-Switch] JSON 解析失败:", e); 
        return; 
    }

    // 4. 标记已处理
    node.setAttribute('data-pk-processed', 'true');

    // 5. 隐藏丑陋的原始文本块 (尝试查找并隐藏)
    // 查找所有可能的代码块容器，如果有我们的暗号，就隐藏它
    const codeBlocks = node.querySelectorAll('pre, code, .TH-render, .hljs');
    codeBlocks.forEach(block => {
        if (block.innerText.includes('[pkbattlestart]')) {
            block.style.display = 'none';
        }
    });
    // 如果没有代码块插件，尝试用正则替换 innerHTML 隐藏文本
    if (codeBlocks.length === 0) {
         const hideRegex = /\[pkbattlestart\][\s\S]*?\[pkbattleend\]/g;
         node.innerHTML = node.innerHTML.replace(hideRegex, `<span style="display:none">DATA_HIDDEN</span>`);
    }

    // 6. 创建并追加按钮
    // 使用 encodeURIComponent 确保数据作为字符串传递时不损坏
    const safeDataStr = encodeURIComponent(JSON.stringify(battleData));
    
    const btnContainer = document.createElement('div');
    btnContainer.className = 'pk-battle-btn-container'; // 身份证
    btnContainer.style.cssText = 'text-align: center; margin-top: 10px; clear: both;';
    
    btnContainer.innerHTML = `
        <button onclick="window.launchPokemonBattle('${safeDataStr}')" 
            style="
                display: inline-block; padding: 12px 24px; 
                background: linear-gradient(to right, #dc2626, #991b1b); 
                color: white; border-radius: 8px; border: none; 
                cursor: pointer; font-weight: bold; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                font-family: 'Roboto', sans-serif; font-size: 14px;
                transition: transform 0.1s;
            "
            onmousedown="this.style.transform='scale(0.95)'" 
            onmouseup="this.style.transform='scale(1)'"
        >
            ⚔️ 遭遇战！点击开始
        </button>
    `;

    // 7. 追加到消息底部 (appendChild 不会破坏上面的 DOM)
    node.appendChild(btnContainer);
    console.log("✅ [Poké-Switch] 按钮注入成功");
}

// ==========================================
// 3. 不死鸟轮询 (The Immortal Loop)
// ==========================================
// 每秒检查一次，确保按钮永远存在
setInterval(() => {
    // 查找所有消息气泡
    const messages = document.querySelectorAll('.mes_text');
    messages.forEach(msg => processMessageNode(msg));
}, 1000);

// 辅助监听器 (为了更快的响应)
const observer = new MutationObserver((mutations) => {
    const messages = document.querySelectorAll('.mes_text');
    messages.forEach(msg => processMessageNode(msg));
});

// 延迟启动监听，等待 SillyTavern 加载完毕
setTimeout(() => {
    const chat = document.querySelector('#chat');
    if (chat) {
        observer.observe(chat, { childList: true, subtree: true, characterData: true });
        console.log("👀 [Poké-Switch] 哨兵已就位");
    }
}, 2000);


// ==========================================
// [Phase 4] 结果回传与 AI 触发 (The Loop)
// ==========================================

window.addEventListener('message', async (event) => {
    // 1. 安全检查
    if (!event.data || event.data.type !== 'BATTLE_RESULT') return;

    const report = event.data.payload;
    console.log("📬 [Poké-Switch] 收到子窗口战报:", report);

    // 2. 销毁战斗窗口 (Iframe)
    // 找到那个全屏遮罩层，直接删掉
    const overlay = document.getElementById('pk-battle-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if(document.body.contains(overlay)) document.body.removeChild(overlay);
        }, 300);
    }

    // 3. 构建战报文本 (Prompt Engineering)
    // 我们要把它包装成一种 AI 容易理解的格式
    // 这里我们决定把它伪装成一条 "System Note" 或者 "User Note"
    
    const statusText = report.isVictory ? "胜利 (Victory)" : "失败 (Defeat)";
    const noteText = report.userNote ? `\n玩家备注/战利品: ${report.userNote}` : "";
    
    const promptText = `
[系统提示: 宝可梦对战结束]
- 结果: ${statusText}
- 我方状态: ${report.p1Status}
- 敌方状态: ${report.p2Status}
${noteText}
- 指令: 请根据以上战斗结果，继续描写剧情。如果玩家赢了，请描写战胜后的喜悦或战利品获取；如果输了，请描写挫败感或逃跑。
`.trim();

    // 4. 调用 SillyTavern API 发送消息
    // 我们使用 sendSysMessage (如果是新版 ST) 或者模拟用户发送
    // 为了稳妥，我们这里使用 "插入到输入框并自动发送" 的策略，
    // 或者直接调用 SillyTavern 的上下文插入 API。
    
    // --- 策略 A: 模拟用户发送 (最通用) ---
    // 优点：兼容性好，能触发 lorebook，就像玩家亲手发的一样
    // 缺点：会显示在聊天记录里 (但这正好也是我们想要的，留个底)
    
    const textarea = document.querySelector('#send_textarea');
    const sendBtn = document.querySelector('#send_but');
    
    if (textarea && sendBtn) {
        // 4.1 填入文本
        // 注意：为了不让这段话看起来太像代码，我们可以加个括号
        // 或者我们可以把它作为 "OOC" (Out Of Character) 发送
        textarea.value = `(系统战报: ${statusText}。我方剩余: ${report.p1Status}。${report.userNote || ""})`;
        
        // 4.2 触发 input 事件 (让 React/Vue 知道值变了)
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 4.3 延迟一点点，然后点击发送
        setTimeout(() => {
            console.log("🚀 [Poké-Switch] 触发 AI 生成...");
            sendBtn.click();
        }, 200);
    } else {
        console.error("❌ 找不到 SillyTavern 的输入框，无法回传结果！");
        alert("战报已复制到剪贴板，请手动粘贴！\n" + promptText);
    }
});


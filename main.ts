import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DING_SOUND, DONG_SOUND } from './audio-data';

interface FocusPluginSettings {
    isRunning: boolean;
	isGaming: boolean;
    soundEnabled: boolean;
	focusTime: number;
}

const DEFAULT_SETTINGS: FocusPluginSettings = {
    isRunning: false,
	isGaming: false,
    soundEnabled: true,
	focusTime: 0
}

export default class FocusPlugin extends Plugin {
    settings: FocusPluginSettings;
    timer: number | null = null;
    cycleTimer: number | null = null;
    startTime: number = 0;
    statusBarItemEl: HTMLElement;

    async onload() {
        await this.loadSettings();

        // 添加状态栏元素
        this.statusBarItemEl = this.addStatusBarItem();
        this.updateStatusBar();

        // 添加开始/停止专注的图标按钮
        const ribbonIconEl = this.addRibbonIcon('alarm-clock', '专注学习模式', (evt: MouseEvent) => {
            if (this.settings.isRunning) {
                this.stopFocus();
            } else {
                this.startFocus();
            }
        });

		const ribbonIconEl2 = this.addRibbonIcon('gamepad-2', '娱乐模式', (evt: MouseEvent) => {
            if (this.settings.isGaming) {
                this.stopGame();
            } else {
                this.startGame();
            }
        });

        // 添加命令
        this.addCommand({
            id: 'toggle-focus-mode',
            name: '切换专注模式',
            callback: () => {
                if (this.settings.isRunning) {
                    this.stopFocus();
                } else {
                    this.startFocus();
                }
            }
        });

        // 添加设置选项
        this.addSettingTab(new FocusSettingTab(this.app, this));
    }

    // 添加更新状态栏的方法
    updateStatusBar() {
        if (this.settings.isRunning) {
            const currentTime = (Date.now() - this.startTime) / 1000 / 60;
            const totalTime = this.settings.focusTime + currentTime;
            this.statusBarItemEl.setText(`本次专注：${currentTime.toFixed(1)}分钟`);
        } else if (this.settings.isGaming) {
            const currentTime = (Date.now() - this.startTime) / 1000 / 60;
            this.statusBarItemEl.setText(`休息时间：${currentTime.toFixed(1)}分钟`);
        } else {
            this.statusBarItemEl.setText(`总专注：${this.settings.focusTime.toFixed(1)}分钟`);
        }
    }

    startFocus() {
        if (this.settings.isGaming) {
        	new Notice('请先停止娱乐模式！');
            return;
        }
        this.settings.isRunning = true;
        this.startTime = Date.now();
        this.saveSettings();

        this.updateStatusBar();
        
        // 开始定时更新状态栏
        this.registerInterval(
            window.setInterval(() => this.updateStatusBar(), 1000)
        );
        
        // 开始随机提醒计时器
        this.scheduleNextReminder();
        
        // 开始90分钟周期计时器
        this.cycleTimer = window.setTimeout(() => {
            this.longBreak();
        }, 90 * 60 * 1000);
        
        new Notice('专注模式已启动！');
    }

    stopFocus() {
        this.settings.isRunning = false;
        
        this.settings.focusTime += (Date.now() - this.startTime) / 1000 / 60;    
        
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.cycleTimer) {
            clearTimeout(this.cycleTimer);
            this.cycleTimer = null;
        }
        this.updateStatusBar();

        this.saveSettings();
        new Notice('专注模式已停止！');
    }

	startGame() {
        if (this.settings.isRunning) {
        	new Notice('请先停止专注模式！');
            return;
        }
        new Notice('开始休息');
        this.settings.isGaming = true;
        this.startTime = Date.now();

        this.updateStatusBar();
        
        // 开始定时更新状态栏
        this.registerInterval(
            window.setInterval(() => this.updateStatusBar(), 1000)
        );

        this.saveSettings();
	}

    stopGame() {
        this.settings.isGaming = false;
        new Notice('结束休息');
        const elapsedMs = Date.now() - this.startTime;
        const elapsedMinutes = elapsedMs / 1000 / 60;
        this.settings.focusTime -= elapsedMinutes;

        this.updateStatusBar();

        this.saveSettings();
    }

	scheduleNextReminder() {
        if (!this.settings.isRunning) return;
        
        this.timer = window.setTimeout(() => {
            // 记录本次实际专注时间
            // this.saveSettings();
            this.shortBreak();
            // 递归调用会重新生成新的随机时间
            this.scheduleNextReminder();
        }, (Math.random() * 2 + 3) * 60 * 1000);  // 移除额外的10秒延迟
    }

    async shortBreak() {
        if (this.settings.soundEnabled) {
			try {
				const audio = new Audio(DING_SOUND);
				await audio.play();
			}  catch (error) {
				console.error('Error playing audio:', error);
				new Notice('播放音频失败：' + error.message);
			}
        }
        
        new Notice('请闭上眼睛休息10秒！', 10000);
        await new Promise(resolve => setTimeout(resolve, 10000));

		// 休息结束音效
        if (this.settings.soundEnabled) {
			const audio = new Audio(DONG_SOUND);
            await audio.play();
        }

        new Notice('继续专注！');
    }

    async longBreak() {
        this.stopFocus();
        new Notice('完成一个专注周期！请休息20分钟。', 20000);
        await new Promise(resolve => setTimeout(resolve, 20 * 60 * 1000));
        new Notice('休息结束，开始新的专注周期！');
        this.startFocus();
    }

    onunload() {
        this.stopFocus();
        this.stopGame();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class FocusSettingTab extends PluginSettingTab {
    plugin: FocusPlugin;

    constructor(app: App, plugin: FocusPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('提示音')
            .setDesc('启用或禁用提示音')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.soundEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.soundEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('专注时间')
            .setDesc('设置专注时间（分钟）')
            .addText(text => text
				.setPlaceholder("Enter a number")
                .setValue(this.plugin.settings.focusTime.toString())
                .onChange(async (value) => {
					const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
						// 如果转换结果是有效的数字，则更新设置
						this.plugin.settings.focusTime = numValue;
						await this.plugin.saveSettings();
					}
                }));
    }
}

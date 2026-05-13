import { describe, expect, it } from 'vitest';

import readme from '../README.md?raw';
import gitignore from '../.gitignore?raw';
import bugReport from '../.github/ISSUE_TEMPLATE/bug_report.md?raw';
import featureRequest from '../.github/ISSUE_TEMPLATE/feature_request.md?raw';
import pullRequestTemplate from '../.github/PULL_REQUEST_TEMPLATE.md?raw';
import codeOfConduct from '../CODE_OF_CONDUCT.md?raw';
import quickstart from '../docs/QUICKSTART.md?raw';
import installation from '../docs/INSTALLATION.md?raw';
import userGuide from '../docs/USER_GUIDE.md?raw';
import developerGuide from '../docs/DEVELOPER_GUIDE.md?raw';
import ollama from '../docs/OLLAMA.md?raw';
import stt from '../docs/STT.md?raw';
import security from '../docs/SECURITY.md?raw';
import troubleshooting from '../docs/TROUBLESHOOTING.md?raw';
import roadmap from '../docs/ROADMAP.md?raw';
import release from '../docs/RELEASE.md?raw';
import contributing from '../docs/CONTRIBUTING.md?raw';
import packageJson from '../package.json?raw';
import setupLinux from '../scripts/setup-linux.sh?raw';
import doctor from '../scripts/doctor.sh?raw';
import validateIcons from '../scripts/validate-icons.sh?raw';
import validateIconAlpha from '../scripts/validate-icon-alpha.mjs?raw';
import commandInputPanel from '../src/components/chat/CommandInputPanel.tsx?raw';

describe('repository public polish', () => {
  it('README and required docs exist with practical commands', () => {
    for (const phrase of [
      '# Ailu AI Studio',
      'Ollama only',
      'Cloud',
      'STT',
      'npm run doctor',
      'npm run tauri:dev',
      'npm run icons:validate',
    ]) {
      expect(readme).toContain(phrase);
    }

    for (const [path, content] of [
      ['docs/QUICKSTART.md', quickstart],
      ['docs/INSTALLATION.md', installation],
      ['docs/USER_GUIDE.md', userGuide],
      ['docs/DEVELOPER_GUIDE.md', developerGuide],
      ['docs/OLLAMA.md', ollama],
      ['docs/STT.md', stt],
      ['docs/SECURITY.md', security],
      ['docs/TROUBLESHOOTING.md', troubleshooting],
      ['docs/ROADMAP.md', roadmap],
      ['docs/RELEASE.md', release],
      ['docs/CONTRIBUTING.md', contributing],
    ] as const) {
      expect(content.length, `${path} should not be a placeholder`).toBeGreaterThan(450);
      expect(content).toMatch(/npm run|ollama|cargo|ffmpeg|security|Cloud|Local|STT|release/i);
    }
  });

  it('GitHub templates and code of conduct are useful', () => {
    expect(bugReport).toContain('Steps to Reproduce');
    expect(featureRequest).toContain('Validation');
    expect(pullRequestTemplate).toContain('No API keys');
    expect(codeOfConduct).toContain('Our Standard');
  });

  it('setup and doctor scripts do not run sudo silently', () => {
    expect(setupLinux).toContain('confirm');
    expect(setupLinux).toContain('Run the Arch dependency command with sudo?');
    expect(setupLinux).not.toContain('sudo -S');
    expect(doctor).not.toContain('sudo pacman');
    expect(doctor).not.toContain('sudo -S');
    expect(doctor).toContain('Ollama local AI');
    expect(doctor).toContain('STT and microphone');
  });

  it('local scratchpad stays local and icon validation is wired', () => {
    expect(gitignore).toContain('CODEX_CONTEXT_BOOTSTRAP.md');
    expect(packageJson).toContain('"icons:validate"');
    expect(validateIcons).toContain('validate-icon-alpha.mjs');
    expect(validateIconAlpha).toContain('alpha');
  });

  it('composer cannot hardcode the old STT install error', () => {
    expect(commandInputPanel).not.toContain('Backend local não configurado. Configurar transcrição local: sudo pacman -S --needed ffmpeg whisper.cpp');
    expect(commandInputPanel).not.toContain('Modelo Whisper não encontrado. Configurar transcrição local: sudo pacman -S --needed ffmpeg whisper.cpp');
    expect(commandInputPanel).not.toContain('result.command');
  });
});

import { test, expect } from '@playwright/test';

test.describe('Ailu AI Studio MVP E2E', () => {
  test('Fluxo completo Operador Local', async ({ page }) => {
    await page.goto('http://localhost:1420');
    
    // 1. Operador: Chat responde oi
    await page.locator('.chat-textarea').fill('oi');
    await page.locator('.btn-primary').click();
    await expect(page.locator('.chat-message-content').filter({ hasText: 'Olá! Sou o Ailu' })).toBeVisible();

    // 2. Operador: arruma bluetooth abre Approval
    await page.locator('.chat-textarea').fill('arruma meu bluetooth');
    await page.locator('.btn-primary').click();
    await expect(page.getByText('⚠️ Aprovação Necessária')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar (Bloquear)' }).click();
    await expect(page.getByText('⚠️ Aprovação Necessária')).not.toBeVisible();

    // 3. Modelos
    await page.locator('.nav-item').filter({ hasText: 'Modelos' }).click();
    await expect(page.getByText('Catálogo de Modelos')).toBeVisible();
    
    // Filtro de modelos
    await page.getByRole('button', { name: 'pesado' }).click();
    await expect(page.getByText('DeepSeek-R1-Distill 32B')).toBeVisible();
    
    // GPT-120b experimental -> Se não tiver HW, deve mostrar 'Experimental'
    await page.getByRole('button', { name: 'experimental' }).click();
    await expect(page.getByText('gpt-oss-120b')).toBeVisible();
    await expect(page.getByText('Experimental')).toBeVisible();

    // 4. Memória
    await page.locator('.nav-item').filter({ hasText: 'Memória' }).click();
    await expect(page.getByText('Memória do Sistema (SQLite)')).toBeVisible();

    // 5. Voz
    await page.locator('.nav-item').filter({ hasText: 'Voz' }).click();
    await expect(page.getByText('Integração de Voz')).toBeVisible();
  });
});

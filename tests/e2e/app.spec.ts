import { test, expect } from '@playwright/test';

test.describe('Ailu AI Studio MVP E2E', () => {
  test('Fluxo completo Operador Local', async ({ page }) => {
    // Note: To test Tauri bridge properly in a full UI, we might need true E2E setup,
    // but we can assert the basic UI components.
    await page.goto('http://localhost:1420');

    // 1. Modelos
    await page.locator('.app-sidebar-item').filter({ hasText: 'Modelos' }).click();
    await expect(page.getByText('Catálogo de Modelos')).toBeVisible();

    // Filtro de modelos experimentais
    await page.getByRole('button', { name: 'experimental' }).click();
    // It should contain gpt-oss:120b
    await expect(page.getByText('gpt-oss:120b')).toBeVisible();

    // Ver o modelo qwen2.5-coder:14b e tentar baixar (abre approval)
    await page.getByRole('button', { name: 'código' }).click();
    await expect(page.getByText('Qwen2.5-Coder 14B')).toBeVisible();
    await page.locator('.app-card').filter({ hasText: 'Qwen2.5-Coder 14B' }).getByRole('button', { name: '⬇️ Baixar / Instalar' }).click();
    await expect(page.getByText('⚠️ Aprovação Necessária')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('⚠️ Aprovação Necessária')).not.toBeVisible();

    // 2. Operador: Chat
    await page.locator('.app-sidebar-item').filter({ hasText: 'Operador' }).click();

    // Pergunta aberta
    await page.locator('.app-textarea').fill('me explique Docker');
    await page.getByRole('button', { name: 'Enviar' }).click();
    // Vai tentar Ollama Fallback ou AirLLM, mas como os mocks do Tauri não retornam ready no CI,
    // vai cair no fallback estático se não tiver ollama models ou "via Ollama" se tiver.
    // Pelo menos garantimos que não deu erro:
    await expect(page.locator('.app-card').filter({ hasText: 'Runtimes indisponíveis' }).or(page.locator('.app-card').filter({ hasText: 'via Ollama' }).or(page.locator('.app-card').filter({ hasText: 'Conectando ao AirLLM' })))).toBeVisible();

    // Ação perigosa -> Approval
    await page.locator('.app-textarea').fill('instala heroic');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('⚠️ Aprovação Necessária')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });
});

# Gestão de Vistoria Inicial

Este projeto é um sistema web para gerenciar vistorias iniciais, pensado para ser acessado pelo navegador no computador ou no celular pela rede local.

## Como usar
1. Execute `run-server.bat` para iniciar o servidor local.
2. Abra o navegador no computador e acesse `http://localhost:8000`.
3. Se quiser usar o celular, acesse `http://<IP-do-computador>:8000` na mesma rede Wi-Fi.
4. Faça login com as credenciais padrão:
   - Usuário: `admin`
   - Senha: `1234`
5. Cadastre, edite e remova registros de vistoria.

## Detalhes do sistema
- Página de login em `login.html`
- Página principal em `index.html`
- Dados são salvos no `localStorage` do navegador
- O servidor Node.js serve os arquivos estáticos para acesso via URL

## Configuração de acesso mobile
- Certifique-se de que o computador e o celular estejam na mesma rede.
- Use o endereço IP do computador no navegador do celular.
- O servidor escuta em todas as interfaces para permitir acesso pela rede local.

## Publicar via GitHub e Vercel
1. Crie um repositório GitHub e envie este projeto para ele.
2. No Vercel, conecte o repositório GitHub ao projeto existente.
3. Configure os secrets do Vercel no GitHub Actions:
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `VERCEL_TOKEN`
4. O fluxo de GitHub Actions em `.github/workflows/vercel-deploy.yml` fará deploy automaticamente quando você enviar commits para a branch `main`.

### Como importar direto do GitHub
- No painel Vercel, clique em `New Project` ou `Import Project`.
- Selecione o repositório GitHub onde seu projeto está hospedado.
- Confirme as configurações e escolha a branch `main`.
- O Vercel detecta o projeto estático automaticamente e publica o site.

### Observação
- Depois que o repositório estiver no GitHub, qualquer push para `main` aciona o deploy automático.
- O site estará disponível na URL gerada pelo Vercel.

# 💰 Finança — App de Controle Financeiro

PWA para controle de gastos e entradas, com previsão de saldo e lançamentos recorrentes.

---

## 🚀 Deploy em 5 passos

### 1. Suba no GitHub
```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/WesleyCodeTech/financa-app.git
git push -u origin main
```

### 2. Deploy no Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Importe o repositório `financa-app`
4. Deixe tudo padrão (Vercel detecta Vite automaticamente)
5. Clique em **Deploy** ✅

### 3. Instalar no celular como app (Android)
1. Abra o link do Vercel no **Chrome**
2. Toque no menu **⋮** (três pontinhos)
3. Selecione **"Adicionar à tela inicial"**
4. Pronto — aparece como ícone igual app nativo!

### 4. Instalar no iPhone (iOS)
1. Abra o link no **Safari**
2. Toque no botão **Compartilhar** (quadrado com seta)
3. Selecione **"Adicionar à Tela de Início"**

---

## 💻 Rodar localmente

```bash
npm install
npm run dev
```

Acesse: http://localhost:5173

## 📦 Gerar build

```bash
npm run build
```

---

## ✨ Funcionalidades

- 📥 Registrar entradas e gastos com categorias
- 🔁 Lançamentos recorrentes (mensal, semanal)
- 💰 Saldo atual + saldo previsto fim do mês
- 📋 Extrato mensal com filtros
- 📈 Previsão dos próximos 6 meses
- 💾 Dados salvos no dispositivo (offline)
- 📱 Funciona como app instalado (PWA)

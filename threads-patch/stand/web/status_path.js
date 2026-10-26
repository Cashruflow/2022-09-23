// СТЕНД: заглушка status_path.js (боевой берёт подписи/цвета из справочника /refs#ticket_status)
export const labelMap = (k, fb) => ({ ...fb, waiting_client: 'ждём клиента' });
export const colorMap = (k, fb) => ({ ...(fb || {}), new: '#4a86e8', in_progress: '#00a0ff', waiting_client: '#f2c960', resolved: '#3dc789' });

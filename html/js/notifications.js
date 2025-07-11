// Notification System
function showNotification(message, type = Config.NOTIFICATION.TYPES.INFO, duration = 3000) {
    const container = document.getElementById('notificationContainer');

    const notification = document.createElement('div');
    notification.className = `notification alert-${type}`;

    const icon = getIconForType(type);
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(notification);

    // Remove notification after duration
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

function getIconForType(type) {
    const icons = {
        [Config.NOTIFICATION.TYPES.SUCCESS]: 'fa-check-circle',
        [Config.NOTIFICATION.TYPES.ERROR]: 'fa-exclamation-circle',
        [Config.NOTIFICATION.TYPES.WARNING]: 'fa-exclamation-triangle',
        [Config.NOTIFICATION.TYPES.INFO]: 'fa-info-circle'
    };
    return icons[type] || icons[Config.NOTIFICATION.TYPES.INFO];
} 
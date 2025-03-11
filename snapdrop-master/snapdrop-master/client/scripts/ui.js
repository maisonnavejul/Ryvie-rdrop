const $ = query => document.getElementById(query);
const $$ = query => document.body.querySelector(query);
const $$$ = query => document.body.querySelectorAll(query);

// set display name
Events.on('display-name', e => {
    const me = e.detail.message;
    const $displayName = $('displayName')
    $displayName.textContent = 'You are known as ' + me.displayName;
    $displayName.title = me.deviceName;
});

class PeersUI {

    constructor() {
        Events.on('peer-joined', e => this._onPeerJoined(e.detail));
        Events.on('peer-left', e => this._onPeerLeft(e.detail));
        Events.on('peers', e => this._onPeers(e.detail));
        Events.on('file-progress', e => this._onFileProgress(e.detail));
        Events.on('paste', e => this._onPaste(e));
    }

    _onPeerJoined(peer) {
        if ($(peer.id)) return; // peer already exists
        const peerUI = new PeerUI(peer);
        $$('x-peers').appendChild(peerUI.$el);
        setTimeout(e => window.animateBackground(false), 1750); // Stop animation
    }

    _onPeers(peers) {
        this._clearPeers();
        peers.forEach(peer => this._onPeerJoined(peer));
    }

    _onPeerLeft(peerId) {
        const $peer = $(peerId);
        if (!$peer) return;
        $peer.remove();
    }

    _onFileProgress(progress) {
        const peerId = progress.sender || progress.recipient;
        const $peer = $(peerId);
        if (!$peer) return;
        $peer.ui.setProgress(progress.progress);
    }

    _clearPeers() {
        const $peers = $$('x-peers').innerHTML = '';
    }

    _onPaste(e) {
        const files = e.clipboardData.files || e.clipboardData.items
            .filter(i => i.type.indexOf('image') > -1)
            .map(i => i.getAsFile());
        const peers = document.querySelectorAll('x-peer');
        // send the pasted image content to the only peer if there is one
        // otherwise, select the peer somehow by notifying the client that
        // "image data has been pasted, click the client to which to send it"
        // not implemented
        if (files.length > 0 && peers.length === 1) {
            Events.fire('files-selected', {
                files: files,
                to: $$('x-peer').id
            });
        }
    }
}

class PeerUI {

    html() {
        return `
        <script src="https://cdn.jsdelivr.net/npm/jszip/dist/jszip.min.js"></script>

            <label class="column center" title="Click to send files or right click to send a text">
                <input type="file" multiple>
                <x-icon shadow="1">
                    <svg class="icon"><use xlink:href="#"/></svg>
                </x-icon>
                <div class="progress">
                  <div class="circle"></div>
                  <div class="circle right"></div>
                </div>
                <div class="name font-subheading"></div>
                <div class="device-name font-body2"></div>
                <div class="status font-body2"></div>
            </label>`
    }

    constructor(peer) {
        this._peer = peer;
        this._initDom();
        this._bindListeners(this.$el);
    }

    _initDom() {
        const el = document.createElement('x-peer');
        el.id = this._peer.id;
        el.innerHTML = this.html();
        el.ui = this;
        el.querySelector('svg use').setAttribute('xlink:href', this._icon());
        el.querySelector('.name').textContent = this._displayName();
        el.querySelector('.device-name').textContent = this._deviceName();
        this.$el = el;
        this.$progress = el.querySelector('.progress');
    }

    _bindListeners(el) {
        el.querySelector('input').addEventListener('change', e => this._onFilesSelected(e));
        el.addEventListener('drop', e => this._onDrop(e));
        el.addEventListener('dragend', e => this._onDragEnd(e));
        el.addEventListener('dragleave', e => this._onDragEnd(e));
        el.addEventListener('dragover', e => this._onDragOver(e));
        el.addEventListener('contextmenu', e => this._onRightClick(e));
        el.addEventListener('touchstart', e => this._onTouchStart(e));
        el.addEventListener('touchend', e => this._onTouchEnd(e));
        // prevent browser's default file drop behavior
        Events.on('dragover', e => e.preventDefault());
        Events.on('drop', e => e.preventDefault());
    }

    _displayName() {
        return this._peer.name.displayName;
    }

    _deviceName() {
        return this._peer.name.deviceName;
    }

    _icon() {
        const device = this._peer.name.device || this._peer.name;
        if (device.type === 'mobile') {
            return '#phone-iphone';
        }
        if (device.type === 'tablet') {
            return '#tablet-mac';
        }
        return '#desktop-mac';
    }

    _onFilesSelected(e) {
        const $input = e.target;
        const files = $input.files;
        Events.fire('files-selected', {
            files: files,
            to: this._peer.id
        });
        $input.value = null; // reset input
    }

    setProgress(progress) {
        if (progress > 0) {
            this.$el.setAttribute('transfer', '1');
        }
        if (progress > 0.5) {
            this.$progress.classList.add('over50');
        } else {
            this.$progress.classList.remove('over50');
        }
        const degrees = `rotate(${360 * progress}deg)`;
        this.$progress.style.setProperty('--progress', degrees);
        if (progress >= 1) {
            this.setProgress(0);
            this.$el.removeAttribute('transfer');
        }
    }

    _onDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer.files;
        Events.fire('files-selected', {
            files: files,
            to: this._peer.id
        });
        this._onDragEnd();
    }

    _onDragOver() {
        this.$el.setAttribute('drop', 1);
    }

    _onDragEnd() {
        this.$el.removeAttribute('drop');
    }

    _onRightClick(e) {
        e.preventDefault();
        Events.fire('text-recipient', this._peer.id);
    }

    _onTouchStart(e) {
        this._touchStart = Date.now();
        this._touchTimer = setTimeout(_ => this._onTouchEnd(), 610);
    }

    _onTouchEnd(e) {
        if (Date.now() - this._touchStart < 500) {
            clearTimeout(this._touchTimer);
        } else { // this was a long tap
            if (e) e.preventDefault();
            Events.fire('text-recipient', this._peer.id);
        }
    }
}


class Dialog {
    constructor(id) {
        this.$el = $(id);
        this.$el.querySelectorAll('[close]').forEach(el => el.addEventListener('click', e => this.hide()))
        this.$autoFocus = this.$el.querySelector('[autofocus]');
    }

    show() {
        this.$el.setAttribute('show', 1);
        if (this.$autoFocus) this.$autoFocus.focus();
    }

    hide() {
        this.$el.removeAttribute('show');
        document.activeElement.blur();
        window.blur();
    }
}

class ReceiveDialog extends Dialog {

    constructor() {
        super('receiveDialog');
        Events.on('file-received', e => {
            this._addFile(e.detail);
            window.blop.play();
        });
        Events.on('transfer-start', e => {
            this._startNewTransfer(e.detail.totalFiles);
        });
        this._filesQueue = [];
        this._downloadAllButton = this.$el.querySelector('#downloadAll');
        this._downloadAllButton.addEventListener('click', () => this._downloadAllFiles());
        this._filesList = this.$el.querySelector('#filesList');
        this._loadingIndicator = this.$el.querySelector('#loadingIndicator');
        this._loadingTimeout = null;
        this._lastFileTime = Date.now();
        this._isTransferActive = false;
        this._expectedFiles = 0;
        this._receivedFiles = 0;
    }

    _startNewTransfer(totalFiles) {
        this._isTransferActive = true;
        this._expectedFiles = totalFiles;
        this._receivedFiles = 0;
        this._filesQueue = [];
        this._filesList.innerHTML = '';
        
        if (this._loadingIndicator) {
            this._loadingIndicator.style.display = 'block';
            const loadingText = this._loadingIndicator.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = `Transfert en cours (0/${totalFiles})...`;
            }
        }
    }

    _addFile(file) {
        const now = Date.now();
        this._lastFileTime = now;
        this._receivedFiles++;

        // Ajouter le fichier à la queue et l'afficher
        this._filesQueue.push(file);
        this._displayFile(file);
        this.show();

        // Mettre à jour le titre
        const $title = this.$el.querySelector('h3');
        $title.textContent = this._filesQueue.length === 1 ? 'Fichier Reçu' : 'Fichiers Reçus';

        // Mettre à jour le message de chargement
        if (this._loadingIndicator) {
            const loadingText = this._loadingIndicator.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = `Transfert en cours (${this._receivedFiles}/${this._expectedFiles})...`;
            }
        }

        // Gérer le bouton "Tout Télécharger"
        if (this._downloadAllButton) {
            this._downloadAllButton.style.display = this._filesQueue.length > 1 ? 'block' : 'none';
        }

        // Vérifier si tous les fichiers sont reçus
        if (this._receivedFiles === this._expectedFiles) {
            this._finishTransfer();
        } else {
            // Réinitialiser le timeout existant
            if (this._loadingTimeout) {
                clearTimeout(this._loadingTimeout);
            }

            // Détecter si c'est une vidéo ou un gros fichier
            const isVideo = file.mime && file.mime.startsWith('video/');
            const isLargeFile = file.size > 5 * 1024 * 1024; // Fichiers > 5MB
            
            if (isVideo || isLargeFile) {
                // Pour les vidéos et gros fichiers, on attend 2 secondes après réception
                this._loadingTimeout = setTimeout(() => this._checkTransferStatus(), 2000);
            } else {
                // Pour les images et petits fichiers, on attend 500ms
                this._loadingTimeout = setTimeout(() => this._checkTransferStatus(), 500);
            }
        }
    }

    _checkTransferStatus() {
        const timeSinceLastFile = Date.now() - this._lastFileTime;
        const lastFile = this._filesQueue[this._filesQueue.length - 1];
        const isLastFileVideo = lastFile && lastFile.mime && lastFile.mime.startsWith('video/');
        const isLastFileLarge = lastFile && lastFile.size > 5 * 1024 * 1024;

        // Si on n'a pas reçu tous les fichiers attendus, on continue d'attendre
        if (this._receivedFiles < this._expectedFiles) {
            return;
        }

        // Si le dernier fichier est une vidéo ou un gros fichier, on attend qu'il soit complètement chargé
        if ((isLastFileVideo || isLastFileLarge) && timeSinceLastFile < 2000) {
            return;
        }

        // Si c'est une image ou un petit fichier, on attend moins longtemps
        if (!isLastFileVideo && !isLastFileLarge && timeSinceLastFile < 500) {
            return;
        }

        this._finishTransfer();
    }

    _finishTransfer() {
        this._isTransferActive = false;
        if (this._loadingIndicator) {
            const loadingText = this._loadingIndicator.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = `Transfert terminé (${this._receivedFiles}/${this._expectedFiles})`;
            }
            setTimeout(() => {
                this._loadingIndicator.style.display = 'none';
            }, 1000);
        }
    }

    _displayFile(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;

        const fileSize = document.createElement('div');
        fileSize.className = 'file-size';
        fileSize.textContent = this._formatFileSize(file.size);

        const downloadButton = document.createElement('button');
        downloadButton.className = 'button download-single';
        downloadButton.textContent = 'Enregistrer';
        downloadButton.onclick = () => this._downloadSingleFile(file);

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);
        fileItem.appendChild(fileInfo);

        if (file.mime && file.mime.split('/')[0] === 'image') {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file.blob);
            fileItem.insertBefore(img, fileInfo);
        }

        fileItem.appendChild(downloadButton);
        this._filesList.appendChild(fileItem);
    }

    _downloadSingleFile(file) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file.blob);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Si c'était le seul fichier, on nettoie tout
        if (this._filesQueue.length === 1) {
            this._filesQueue = [];
            this._filesList.innerHTML = '';
            this.hide();
        }
    }

    _downloadAllFiles() {
        if (this._filesQueue.length === 0) return;

        // Télécharge chaque fichier
        this._filesQueue.forEach(file => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(file.blob);
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(a.href);
            document.body.removeChild(a);
        });

        const nbFichiers = this._filesQueue.length;
        const message = nbFichiers > 1 
            ? `✅ ${nbFichiers} fichiers ont été téléchargés avec succès !`
            : `✅ Le fichier a été téléchargé avec succès !`;
        
        Events.fire('notify-user', message);
        
        this._filesQueue = [];
        this._filesList.innerHTML = '';
        this.hide();
    }

    hide() {
        super.hide();
        if (this._filesQueue.length === 0) {
            this._filesList.innerHTML = '';
        }
    }

    _formatFileSize(bytes) {
        if (bytes >= 1e9) {
            return (Math.round(bytes / 1e8) / 10) + ' GB';
        } else if (bytes >= 1e6) {
            return (Math.round(bytes / 1e5) / 10) + ' MB';
        } else if (bytes > 1000) {
            return Math.round(bytes / 1000) + ' KB';
        } else {
            return bytes + ' Bytes';
        }
    }
}

class SendTextDialog extends Dialog {
    constructor() {
        super('sendTextDialog');
        Events.on('text-recipient', e => this._onRecipient(e.detail))
        this.$text = this.$el.querySelector('#textInput');
        const button = this.$el.querySelector('form');
        button.addEventListener('submit', e => this._send(e));
    }

    _onRecipient(recipient) {
        this._recipient = recipient;
        this._handleShareTargetText();
        this.show();

        const range = document.createRange();
        const sel = window.getSelection();

        range.selectNodeContents(this.$text);
        sel.removeAllRanges();
        sel.addRange(range);

    }

    _handleShareTargetText() {
        if (!window.shareTargetText) return;
        this.$text.textContent = window.shareTargetText;
        window.shareTargetText = '';
    }

    _send(e) {
        e.preventDefault();
        Events.fire('send-text', {
            to: this._recipient,
            text: this.$text.innerText
        });
    }
}

class ReceiveTextDialog extends Dialog {
    constructor() {
        super('receiveTextDialog');
        Events.on('text-received', e => this._onText(e.detail))
        this.$text = this.$el.querySelector('#text');
        const $copy = this.$el.querySelector('#copy');
        copy.addEventListener('click', _ => this._onCopy());
    }

    _onText(e) {
        this.$text.innerHTML = '';
        const text = e.text;
        if (isURL(text)) {
            const $a = document.createElement('a');
            $a.href = text;
            $a.target = '_blank';
            $a.textContent = text;
            this.$text.appendChild($a);
        } else {
            this.$text.textContent = text;
        }
        this.show();
        window.blop.play();
    }

    async _onCopy() {
        await navigator.clipboard.writeText(this.$text.textContent);
        Events.fire('notify-user', 'Copied to clipboard');
    }
}

class Toast extends Dialog {
    constructor() {
        super('toast');
        Events.on('notify-user', e => this._onNotfiy(e.detail));
    }

    _onNotfiy(message) {
        this.$el.textContent = message;
        this.show();
        setTimeout(_ => this.hide(), 3000);
    }
}


class Notifications {

    constructor() {
        // Check if the browser supports notifications
        if (!('Notification' in window)) return;

        // Check whether notification permissions have already been granted
        if (Notification.permission !== 'granted') {
            this.$button = $('notification');
            this.$button.removeAttribute('hidden');
            this.$button.addEventListener('click', e => this._requestPermission());
        }
        Events.on('text-received', e => this._messageNotification(e.detail.text));
        Events.on('file-received', e => this._downloadNotification(e.detail.name));
    }

    _requestPermission() {
        Notification.requestPermission(permission => {
            if (permission !== 'granted') {
                Events.fire('notify-user', Notifications.PERMISSION_ERROR || 'Error');
                return;
            }
            this._notify('Even more snappy sharing!');
            this.$button.setAttribute('hidden', 1);
        });
    }

    _notify(message, body) {
        const config = {
            body: body,
            icon: '/images/logo_transparent_128x128.png',
        }
        let notification;
        try {
            notification = new Notification(message, config);
        } catch (e) {
            // Android doesn't support "new Notification" if service worker is installed
            if (!serviceWorker || !serviceWorker.showNotification) return;
            notification = serviceWorker.showNotification(message, config);
        }

        // Notification is persistent on Android. We have to close it manually
        const visibilitychangeHandler = () => {                             
            if (document.visibilityState === 'visible') {    
                notification.close();
                Events.off('visibilitychange', visibilitychangeHandler);
            }                                                       
        };                                                                                
        Events.on('visibilitychange', visibilitychangeHandler);

        return notification;
    }

    _messageNotification(message) {
        if (document.visibilityState !== 'visible') {
            if (isURL(message)) {
                const notification = this._notify(message, 'Click to open link');
                this._bind(notification, e => window.open(message, '_blank', null, true));
            } else {
                const notification = this._notify(message, 'Click to copy text');
                this._bind(notification, e => this._copyText(message, notification));
            }
        }
    }

    _downloadNotification(message) {
        if (document.visibilityState !== 'visible') {
            const notification = this._notify(message, 'Click to download');
            if (!window.isDownloadSupported) return;
            this._bind(notification, e => this._download(notification));
        }
    }

    _download(notification) {
        document.querySelector('x-dialog [download]').click();
        notification.close();
    }

    _copyText(message, notification) {
        notification.close();
        if (!navigator.clipboard.writeText(message)) return;
        this._notify('Copied text to clipboard');
    }

    _bind(notification, handler) {
        if (notification.then) {
            notification.then(e => serviceWorker.getNotifications().then(notifications => {
                serviceWorker.addEventListener('notificationclick', handler);
            }));
        } else {
            notification.onclick = handler;
        }
    }
}


class NetworkStatusUI {

    constructor() {
        window.addEventListener('offline', e => this._showOfflineMessage(), false);
        window.addEventListener('online', e => this._showOnlineMessage(), false);
        if (!navigator.onLine) this._showOfflineMessage();
    }

    _showOfflineMessage() {
        Events.fire('notify-user', 'You are offline');
    }

    _showOnlineMessage() {
        Events.fire('notify-user', 'You are back online');
    }
}

class WebShareTargetUI {
    constructor() {
        const parsedUrl = new URL(window.location);
        const title = parsedUrl.searchParams.get('title');
        const text = parsedUrl.searchParams.get('text');
        const url = parsedUrl.searchParams.get('url');

        let shareTargetText = title ? title : '';
        shareTargetText += text ? shareTargetText ? ' ' + text : text : '';

        if(url) shareTargetText = url; // We share only the Link - no text. Because link-only text becomes clickable.

        if (!shareTargetText) return;
        window.shareTargetText = shareTargetText;
        history.pushState({}, 'URL Rewrite', '/');
        console.log('Shared Target Text:', '"' + shareTargetText + '"');
    }
}


class Snapdrop {
    constructor() {
        const server = new ServerConnection();
        const peers = new PeersManager(server);
        const peersUI = new PeersUI();
        Events.on('load', e => {
            const receiveDialog = new ReceiveDialog();
            const sendTextDialog = new SendTextDialog();
            const receiveTextDialog = new ReceiveTextDialog();
            const toast = new Toast();
            const notifications = new Notifications();
            const networkStatusUI = new NetworkStatusUI();
            const webShareTargetUI = new WebShareTargetUI();
        });
    }
}

const snapdrop = new Snapdrop();



if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(serviceWorker => {
            console.log('Service Worker registered');
            window.serviceWorker = serviceWorker
        });
}

window.addEventListener('beforeinstallprompt', e => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        // don't display install banner when installed
        return e.preventDefault();
    } else {
        const btn = document.querySelector('#install')
        btn.hidden = false;
        btn.onclick = _ => e.prompt();
        return e.preventDefault();
    }
});

// Background Animation
Events.on('load', () => {
    let c = document.createElement('canvas');
    document.body.appendChild(c);
    let style = c.style;
    style.width = '100%';
    style.position = 'absolute';
    style.zIndex = -1;
    style.top = 0;
    style.left = 0;
    let ctx = c.getContext('2d');
    let x0, y0, w, h, dw;

    function init() {
        w = window.innerWidth;
        h = window.innerHeight;
        c.width = w;
        c.height = h;
        let offset = h > 380 ? 100 : 65;
        offset = h > 800 ? 116 : offset;
        x0 = w / 2;
        y0 = h - offset;
        dw = Math.max(w, h, 1000) / 13;
        drawCircles();
    }
    window.onresize = init;

    function drawCircle(radius) {
        ctx.beginPath();
        let color = Math.round(197 * (1 - radius / Math.max(w, h)));
        ctx.strokeStyle = 'rgba(' + color + ',' + color + ',' + color + ',0.1)';
        ctx.arc(x0, y0, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.lineWidth = 2;
    }

    let step = 0;

    function drawCircles() {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) {
            drawCircle(dw * i + step % dw);
        }
        step += 1;
    }

    let loading = true;

    function animate() {
        if (loading || step % dw < dw - 5) {
            requestAnimationFrame(function() {
                drawCircles();
                animate();
            });
        }
    }
    window.animateBackground = function(l) {
        loading = l;
        animate();
    };
    init();
    animate();
});
const peerFileManager = new PeerFileManager();

class PeerFileManager {
    constructor() {
        this.receivedFiles = [];
        Events.on('file-received', e => this.addFile(e.detail));
    }

    addFile(fileDetail) {
        this.receivedFiles.push(fileDetail);
        this.displayFile(fileDetail);
    }

    displayFile(fileDetail) {
        const container = document.getElementById('received-files');
        const file = fileDetail.blob;
        const url = URL.createObjectURL(file);

        const fileContainer = document.createElement('div');

        if (file.type.startsWith('image')) {
            const img = document.createElement('img');
            img.src = url;
            img.classList.add('preview-image');
            fileInfo.appendChild(img);
        }

        const fileInfo = document.createElement('p');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = `${fileDetail.name} (${this.formatSize(fileDetail.size)})`;
        fileInfo.appendChild(fileName);
        document.getElementById('received-files').appendChild(fileInfo);
    }

    downloadAllFiles() {
        const zip = new JSZip();
        this.receivedFiles.forEach(fileDetail => {
            zip.file(fileDetail.name, fileDetail.blob);
        });

        zip.generateAsync({type: "blob"}).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = "photos.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    formatSize(bytes) {
        if (bytes >= 1e9) {
            return (Math.round(bytes / 1e8) / 10) + ' GB';
        } else if (bytes >= 1e6) {
            return (Math.round(bytes / 1e5) / 10) + ' MB';
        } else if (bytes > 1000) {
            return Math.round(bytes / 1000) + ' KB';
        } else {
            return bytes + ' Bytes';
        }
    }
}

Notifications.PERMISSION_ERROR = `
Notifications permission has been blocked
as the user has dismissed the permission prompt several times.
This can be reset in Page Info
which can be accessed by clicking the lock icon next to the URL.`;

document.body.onclick = e => { // safari hack to fix audio
    document.body.onclick = null;
    if (!(/.*Version.*Safari.*/.test(navigator.userAgent))) return;
    blop.play();
}

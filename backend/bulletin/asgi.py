import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bulletin.settings')

django_asgi_app = get_asgi_application()

import notes.routing

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': URLRouter(
        notes.routing.websocket_urlpatterns
    ),
})

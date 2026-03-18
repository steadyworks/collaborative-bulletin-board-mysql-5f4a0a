from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/$', consumers.BulletinConsumer.as_asgi()),
    re_path(r'$', consumers.BulletinConsumer.as_asgi()),
]

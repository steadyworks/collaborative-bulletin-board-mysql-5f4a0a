import json
from channels.generic.websocket import AsyncWebsocketConsumer

connected_count = 0


class BulletinConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        global connected_count
        connected_count += 1
        await self.channel_layer.group_add('bulletin', self.channel_name)
        await self.accept()
        await self.channel_layer.group_send('bulletin', {
            'type': 'user_count',
            'count': connected_count,
        })

    async def disconnect(self, close_code):
        global connected_count
        connected_count = max(0, connected_count - 1)
        await self.channel_layer.group_discard('bulletin', self.channel_name)
        await self.channel_layer.group_send('bulletin', {
            'type': 'user_count',
            'count': connected_count,
        })

    async def receive(self, text_data):
        pass

    async def note_created(self, event):
        await self.send(text_data=json.dumps({
            'type': 'note_created',
            'note': event['note'],
        }))

    async def note_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'note_updated',
            'note': event['note'],
        }))

    async def note_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'note_deleted',
            'id': event['id'],
        }))

    async def user_count(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_count',
            'count': event['count'],
        }))

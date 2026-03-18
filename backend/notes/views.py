import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Note

channel_layer = get_channel_layer()


def note_to_dict(note):
    return {
        'id': str(note.id),
        'text': note.text,
        'x': note.x,
        'y': note.y,
    }


@csrf_exempt
def notes_list(request):
    if request.method == 'GET':
        notes = Note.objects.all()
        return JsonResponse([note_to_dict(n) for n in notes], safe=False)

    if request.method == 'POST':
        data = json.loads(request.body)
        note = Note.objects.create(
            text='',
            x=data.get('x', 0),
            y=data.get('y', 0),
        )
        note_data = note_to_dict(note)
        async_to_sync(channel_layer.group_send)('bulletin', {
            'type': 'note_created',
            'note': note_data,
        })
        return JsonResponse(note_data, status=201)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def note_detail(request, note_id):
    note_id = int(note_id)

    if request.method == 'PUT':
        data = json.loads(request.body)
        note, created = Note.objects.update_or_create(
            id=note_id,
            defaults={
                'text': data.get('text', ''),
                'x': data.get('x', 0),
                'y': data.get('y', 0),
            }
        )
        note_data = note_to_dict(note)
        async_to_sync(channel_layer.group_send)('bulletin', {
            'type': 'note_updated',
            'note': note_data,
        })
        return JsonResponse(note_data)

    if request.method == 'DELETE':
        Note.objects.filter(id=note_id).delete()
        async_to_sync(channel_layer.group_send)('bulletin', {
            'type': 'note_deleted',
            'id': str(note_id),
        })
        return JsonResponse({'status': 'deleted'})

    return JsonResponse({'error': 'Method not allowed'}, status=405)

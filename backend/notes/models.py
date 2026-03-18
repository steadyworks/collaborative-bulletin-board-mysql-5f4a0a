from django.db import models


class Note(models.Model):
    text = models.TextField(blank=True, default='')
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'board_notes'

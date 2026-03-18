from django.urls import path
from . import views

urlpatterns = [
    path('notes/', views.notes_list),
    path('notes/<int:note_id>/', views.note_detail),
]
